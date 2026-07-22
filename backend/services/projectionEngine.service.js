// ============================================================
// PHASE 5: CQRS READ PROJECTION ENGINE
// ============================================================
// Purpose: Pre-aggregate account balances by dimensions for
//          instant financial reporting (< 50ms queries)
// ============================================================

export class ProjectionEngine {
    constructor(db, redis, queueService) {
        this.db = db;
        this.redis = redis;
        this.queueService = queueService;
    }

    // ============================================================
    // CORE PROJECTION LOGIC
    // ============================================================

    /**
     * Project a single voucher into account_dimension_balances
     * This is called asynchronously after voucher approval
     * @param {string} voucherId - UUID of the approved voucher
     */
    async projectVoucher(voucherId) {
        const startTime = Date.now();
        
        try {
            // 1. Fetch voucher with details and dimensions
            const voucherResult = await this.db.query(
                `SELECT v.company_id, v.post_date, v.status, v.voucher_type
                 FROM vouchers v
                 WHERE v.id = $1`,
                [voucherId]
            );

            if (voucherResult.rows.length === 0) {
                throw new Error(`Voucher ${voucherId} not found`);
            }

            const voucher = voucherResult.rows[0];

            // 2. Fetch voucher details with dimensions
            const detailsResult = await this.db.query(
                `SELECT vd.account_code, vd.entry_type, vd.amount, vd.dimensions
                 FROM voucher_details vd
                 WHERE vd.voucher_id = $1`,
                [voucherId]
            );

            if (detailsResult.rows.length === 0) {
                console.log(`[ProjectionEngine] No details found for voucher ${voucherId}`);
                return { success: true, projected: 0 };
            }

            // 3. Process each line
            let projectedLines = 0;
            const date = new Date(voucher.post_date);
            const fiscalYear = date.getFullYear();
            const fiscalPeriod = date.getMonth() + 1; // 1-12

            for (const line of detailsResult.rows) {
                const { account_code, entry_type, amount, dimensions } = line;

                // Skip if no dimensions
                if (!dimensions || Object.keys(dimensions).length === 0) {
                    continue;
                }

                const isDebit = entry_type === 'DR';
                const debitAdd = isDebit ? amount : 0;
                const creditAdd = isDebit ? 0 : amount;

                // 4. Project each dimension
                for (const [dimKey, dimVal] of Object.entries(dimensions)) {
                    if (!dimVal || dimVal === '') continue;

                    await this.db.query(`
                        INSERT INTO account_dimension_balances 
                            (company_id, fiscal_year, fiscal_period, account_code, dimension_key, dimension_value, debit_accumulated, credit_accumulated)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (company_id, fiscal_year, fiscal_period, account_code, dimension_key, dimension_value)
                        DO UPDATE SET 
                            debit_accumulated = account_dimension_balances.debit_accumulated + EXCLUDED.debit_accumulated,
                            credit_accumulated = account_dimension_balances.credit_accumulated + EXCLUDED.credit_accumulated,
                            updated_at = CURRENT_TIMESTAMP
                    `, [
                        voucher.company_id,
                        fiscalYear,
                        fiscalPeriod,
                        account_code,
                        dimKey,
                        dimVal.toString(),
                        debitAdd,
                        creditAdd
                    ]);

                    projectedLines++;
                }
            }

            // 5. Log success
            await this.logProjection(voucherId, 'SUCCESS', null, projectedLines);

            // 6. Invalidate report cache
            await this.invalidateReportCache(voucher.company_id);

            const duration = Date.now() - startTime;
            console.log(`[ProjectionEngine] Projected voucher ${voucherId} in ${duration}ms (${projectedLines} lines)`);

            return {
                success: true,
                projected: projectedLines,
                duration: duration
            };

        } catch (error) {
            console.error(`[ProjectionEngine] Error projecting voucher ${voucherId}:`, error);
            
            // Log failure
            await this.logProjection(voucherId, 'FAILED', error.message, 0);
            
            throw error;
        }
    }

    /**
     * Process pending projections from projection_log
     * This is called by a worker to process failed/retry projections
     */
    async processPendingProjections(limit = 100) {
        try {
            // Fetch pending projections
            const result = await this.db.query(`
                SELECT id, voucher_id, company_id
                FROM projection_log
                WHERE status = 'PENDING'
                ORDER BY processed_at ASC
                LIMIT $1
            `, [limit]);

            console.log(`[ProjectionEngine] Processing ${result.rows.length} pending projections`);

            let processed = 0;
            let failed = 0;

            for (const row of result.rows) {
                try {
                    await this.projectVoucher(row.voucher_id);
                    
                    // Mark as success
                    await this.db.query(`
                        UPDATE projection_log
                        SET status = 'SUCCESS', processed_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                    `, [row.id]);

                    processed++;
                } catch (error) {
                    // Mark as failed (will retry on next run)
                    await this.db.query(`
                        UPDATE projection_log
                        SET status = 'FAILED', 
                            error_message = $1,
                            processed_at = CURRENT_TIMESTAMP
                        WHERE id = $2
                    `, [error.message, row.id]);

                    failed++;
                }
            }

            console.log(`[ProjectionEngine] Processed: ${processed}, Failed: ${failed}`);
            
            return { processed, failed };

        } catch (error) {
            console.error('[ProjectionEngine] Error processing pending projections:', error);
            throw error;
        }
    }

    // ============================================================
    // REPORT GENERATION (Read-side queries)
    // ============================================================

    /**
     * Get account balances by dimensions for reporting
     * @param {Object} filters - { company_id, fiscal_year, fiscal_period, dimension_key, dimension_value }
     */
    async getDimensionBalances(filters) {
        const {
            company_id,
            fiscal_year,
            fiscal_period,
            dimension_key,
            dimension_value,
            account_code
        } = filters;

        let query = `
            SELECT 
                company_id,
                fiscal_year,
                fiscal_period,
                account_code,
                dimension_key,
                dimension_value,
                debit_accumulated,
                credit_accumulated,
                (debit_accumulated - credit_accumulated) as net_balance,
                updated_at
            FROM account_dimension_balances
            WHERE company_id = $1
              AND fiscal_year = $2
        `;

        const params = [company_id, fiscal_year];
        let paramCount = 2;

        // Add optional filters
        if (fiscal_period) {
            paramCount++;
            query += ` AND fiscal_period = $${paramCount}`;
            params.push(fiscal_period);
        }

        if (dimension_key) {
            paramCount++;
            query += ` AND dimension_key = $${paramCount}`;
            params.push(dimension_key);
        }

        if (dimension_value) {
            paramCount++;
            query += ` AND dimension_value = $${paramCount}`;
            params.push(dimension_value);
        }

        if (account_code) {
            paramCount++;
            query += ` AND account_code = $${paramCount}`;
            params.push(account_code);
        }

        query += ` ORDER BY account_code, dimension_key, dimension_value`;

        const result = await this.db.query(query, params);
        return result.rows;
    }

    /**
     * Get P&L (Profit & Loss) report by dimensions
     * @param {Object} filters - { company_id, year, from_period, to_period, dimension_key, dimension_value }
     */
    async getProfitLossByDimension(filters) {
        const {
            company_id,
            year,
            from_period = 1,
            to_period = 12,
            dimension_key,
            dimension_value
        } = filters;

        // Define P&L account ranges (Vietnamese accounting standards)
        const revenueAccounts = ['511', '512', '515']; // Doanh thu bán hàng
        const cogsAccounts = ['632']; // Giá vốn hàng bán
        const expenseAccounts = ['641', '642', '643', '644', '650', '651', '652', '653', '654', '655', '656', '657', '658', '659', '661', '662', '663', '664', '665', '666', '667', '668', '669', '670', '671', '672', '673', '674', '675', '676', '677', '678', '679']; // Chi phí

        const query = `
            SELECT 
                account_code,
                dimension_key,
                dimension_value,
                SUM(debit_accumulated) as total_debit,
                SUM(credit_accumulated) as total_credit,
                CASE 
                    WHEN account_code = ANY($3::text[]) THEN SUM(credit_accumulated) - SUM(debit_accumulated)
                    WHEN account_code = ANY($4::text[]) THEN SUM(debit_accumulated) - SUM(credit_accumulated)
                    ELSE 0
                END as net_amount
            FROM account_dimension_balances
            WHERE company_id = $1
              AND fiscal_year = $2
              AND fiscal_period BETWEEN $5 AND $6
              AND dimension_key = $7
              AND dimension_value = $8
              AND account_code = ANY($9::text[])
            GROUP BY account_code, dimension_key, dimension_value
            ORDER BY account_code
        `;

        const allAccounts = [...revenueAccounts, ...cogsAccounts, ...expenseAccounts];
        
        const result = await this.db.query(query, [
            company_id,
            year,
            revenueAccounts,
            expenseAccounts,
            from_period,
            to_period,
            dimension_key,
            dimension_value,
            allAccounts
        ]);

        // Calculate totals
        let totalRevenue = 0;
        let totalCOGS = 0;
        let totalExpenses = 0;

        for (const row of result.rows) {
            if (revenueAccounts.includes(row.account_code)) {
                totalRevenue += parseFloat(row.net_amount);
            } else if (cogsAccounts.includes(row.account_code)) {
                totalCOGS += parseFloat(row.net_amount);
            } else if (expenseAccounts.includes(row.account_code)) {
                totalExpenses += parseFloat(row.net_amount);
            }
        }

        const grossProfit = totalRevenue - totalCOGS;
        const netProfit = grossProfit - totalExpenses;

        return {
            details: result.rows,
            summary: {
                totalRevenue,
                totalCOGS,
                grossProfit,
                totalExpenses,
                netProfit
            },
            filters: {
                company_id,
                year,
                from_period,
                to_period,
                dimension_key,
                dimension_value
            }
        };
    }

    /**
     * Get Balance Sheet by dimensions
     */
    async getBalanceSheetByDimension(filters) {
        const {
            company_id,
            year,
            period = 12, // Default to end of year
            dimension_key,
            dimension_value
        } = filters;

        // Define BS account ranges
        const assetAccounts = ['100', '110', '111', '112', '113', '114', '115', '116', '117', '118', '119', '120', '121', '122', '123', '124', '125', '126', '127', '128', '129', '130', '131', '132', '133', '134', '135', '136', '137', '138', '139', '140', '141', '142', '143', '144', '145', '146', '147', '148', '149', '150', '151', '152', '153', '154', '155', '156', '157', '158', '159', '160', '161', '162', '163', '164', '165', '166', '167', '168', '169', '170', '171', '172', '173', '174', '175', '176', '177', '178', '179', '180', '181', '182', '183', '184', '185', '186', '187', '188', '189', '190', '191', '192', '193', '194', '195', '196', '197', '198', '199'];
        const liabilityAccounts = ['200', '210', '211', '212', '213', '214', '215', '216', '217', '218', '219', '220', '221', '222', '223', '224', '225', '226', '227', '228', '229', '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240', '241', '242', '243', '244', '245', '246', '247', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258', '259', '260', '261', '262', '263', '264', '265', '266', '267', '268', '269', '270', '271', '272', '273', '274', '275', '276', '277', '278', '279', '280', '281', '282', '283', '284', '285', '286', '287', '288', '289', '290', '291', '292', '293', '294', '295', '296', '297', '298', '299'];
        const equityAccounts = ['400', '410', '411', '412', '413', '414', '415', '416', '417', '418', '419', '420', '421', '422', '423', '424', '425', '426', '427', '428', '429'];

        const query = `
            SELECT 
                account_code,
                dimension_key,
                dimension_value,
                SUM(debit_accumulated - credit_accumulated) as net_balance
            FROM account_dimension_balances
            WHERE company_id = $1
              AND fiscal_year = $2
              AND fiscal_period <= $3
              AND dimension_key = $4
              AND dimension_value = $5
              AND (
                  account_code = ANY($6::text[])
                  OR account_code = ANY($7::text[])
                  OR account_code = ANY($8::text[])
              )
            GROUP BY account_code, dimension_key, dimension_value
            ORDER BY account_code
        `;

        const result = await this.db.query(query, [
            company_id,
            year,
            period,
            dimension_key,
            dimension_value,
            assetAccounts,
            liabilityAccounts,
            equityAccounts
        ]);

        // Calculate totals
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalEquity = 0;

        for (const row of result.rows) {
            const balance = parseFloat(row.net_balance);
            if (assetAccounts.some(acc => row.account_code.startsWith(acc.substring(0, 3)))) {
                totalAssets += balance;
            } else if (liabilityAccounts.some(acc => row.account_code.startsWith(acc.substring(0, 3)))) {
                totalLiabilities += balance;
            } else if (equityAccounts.some(acc => row.account_code.startsWith(acc.substring(0, 3)))) {
                totalEquity += balance;
            }
        }

        return {
            details: result.rows,
            summary: {
                totalAssets,
                totalLiabilities,
                totalEquity,
                totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
                isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01
            },
            filters: {
                company_id,
                year,
                period,
                dimension_key,
                dimension_value
            }
        };
    }

    // ============================================================
    // CACHE MANAGEMENT
    // ============================================================

    /**
     * Invalidate report cache for a company
     */
    async invalidateReportCache(companyId) {
        if (!companyId) return;

        try {
            // Delete from report_cache table
            await this.db.query(`
                DELETE FROM report_cache
                WHERE company_id = $1
                  AND expires_at > CURRENT_TIMESTAMP
            `, [companyId]);

            // Delete from Redis cache
            const pattern = `reports:${companyId}:*`;
            const keys = await this.redis.keys(pattern);
            
            if (keys.length > 0) {
                await this.redis.del(keys);
                console.log(`[ProjectionEngine] Invalidated ${keys.length} cache keys for company ${companyId}`);
            }
        } catch (error) {
            console.error(`[ProjectionEngine] Error invalidating cache for company ${companyId}:`, error);
        }
    }

    /**
     * Cache a report result
     */
    async cacheReport(companyId, reportType, filters, data, ttlSeconds = 300) {
        try {
            const reportKey = this.generateReportKey(reportType, filters);
            const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

            // Cache in PostgreSQL
            await this.db.query(`
                INSERT INTO report_cache (company_id, report_type, report_key, report_data, expires_at)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (company_id, report_type, report_key)
                DO UPDATE SET 
                    report_data = EXCLUDED.report_data,
                    cached_at = CURRENT_TIMESTAMP,
                    expires_at = EXCLUDED.expires_at
            `, [companyId, reportType, reportKey, JSON.stringify(data), expiresAt]);

            // Cache in Redis for faster access
            await this.redis.setex(
                `reports:${companyId}:${reportType}:${reportKey}`,
                ttlSeconds,
                JSON.stringify(data)
            );

            console.log(`[ProjectionEngine] Cached ${reportType} report for company ${companyId}`);
        } catch (error) {
            console.error(`[ProjectionEngine] Error caching report:`, error);
        }
    }

    /**
     * Get cached report
     */
    async getCachedReport(companyId, reportType, filters) {
        try {
            const reportKey = this.generateReportKey(reportType, filters);

            // Try Redis first (faster)
            const redisData = await this.redis.get(`reports:${companyId}:${reportType}:${reportKey}`);
            if (redisData) {
                return JSON.parse(redisData);
            }

            // Fallback to PostgreSQL
            const result = await this.db.query(`
                SELECT report_data
                FROM report_cache
                WHERE company_id = $1
                  AND report_type = $2
                  AND report_key = $3
                  AND expires_at > CURRENT_TIMESTAMP
            `, [companyId, reportType, reportKey]);

            if (result.rows.length > 0) {
                const data = JSON.parse(result.rows[0].report_data);
                
                // Re-cache in Redis
                const ttl = Math.floor((new Date(result.rows[0].expires_at) - Date.now()) / 1000);
                if (ttl > 0) {
                    await this.redis.setex(
                        `reports:${companyId}:${reportType}:${reportKey}`,
                        ttl,
                        JSON.stringify(data)
                    );
                }

                return data;
            }

            return null;
        } catch (error) {
            console.error(`[ProjectionEngine] Error getting cached report:`, error);
            return null;
        }
    }

    // ============================================================
    // HELPER FUNCTIONS
    // ============================================================

    /**
     * Log projection event
     */
    async logProjection(voucherId, status, errorMessage, projectedLines) {
        try {
            // Get company_id from voucher
            const voucherResult = await this.db.query(
                'SELECT company_id FROM vouchers WHERE id = $1',
                [voucherId]
            );

            const companyId = voucherResult.rows[0]?.company_id;

            await this.db.query(`
                INSERT INTO projection_log (company_id, voucher_id, projection_type, status, error_message)
                VALUES ($1, $2, 'ACCOUNT_DIMENSION_BALANCE', $3, $4)
            `, [companyId, voucherId, status, errorMessage]);
        } catch (error) {
            console.error('[ProjectionEngine] Error logging projection:', error);
        }
    }

    /**
     * Generate MD5 hash for report cache key
     */
    generateReportKey(reportType, filters) {
        const crypto = require('crypto');
        const filterString = JSON.stringify(filters);
        return crypto.createHash('md5').update(`${reportType}:${filterString}`).digest('hex');
    }

    /**
     * Cleanup old projection logs (older than 30 days)
     */
    async cleanupOldProjectionLogs() {
        try {
            const result = await this.db.query(`
                DELETE FROM projection_log
                WHERE processed_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
                RETURNING id
            `);

            console.log(`[ProjectionEngine] Cleaned up ${result.rowCount} old projection logs`);
            return result.rowCount;
        } catch (error) {
            console.error('[ProjectionEngine] Error cleaning up old logs:', error);
            return 0;
        }
    }

    // ============================================================
    // CONSISTENCY AUDIT & RECONCILIATION
    // ============================================================

    /**
     * Run full consistency audit between write-side and read-side
     * @param {number} companyId - Company ID to audit
     */
    async runConsistencyAudit(companyId) {
        try {
            console.log(`[ProjectionEngine] Running consistency audit for company ${companyId}`);

            // 1. Get all approved vouchers with dimensions
            const vouchersResult = await this.db.query(`
                SELECT v.id, v.voucher_number, v.post_date, v.status
                FROM vouchers v
                WHERE v.company_id = $1
                  AND v.status = 'APPROVED'
                  AND EXISTS (
                    SELECT 1 FROM voucher_details vd
                    WHERE vd.voucher_id = v.id
                      AND vd.dimensions IS NOT NULL
                      AND jsonb_object_keys(vd.dimensions) IS NOT NULL
                  )
                ORDER BY v.post_date ASC
            `, [companyId]);

            const totalVouchers = vouchersResult.rows.length;
            let projectedVouchers = 0;
            let unprojectedVouchers = 0;
            let mismatchedVouchers = 0;
            const discrepancies = [];

            // 2. Check each voucher
            for (const voucher of vouchersResult.rows) {
                // Check if voucher was projected
                const projectionResult = await this.db.query(`
                    SELECT COUNT(*) as count
                    FROM projection_log
                    WHERE voucher_id = $1
                      AND status = 'SUCCESS'
                `, [voucher.id]);

                const isProjected = parseInt(projectionResult.rows[0]?.count || 0) > 0;

                if (!isProjected) {
                    unprojectedVouchers++;
                    discrepancies.push({
                        type: 'UNPROJECTED',
                        voucher_id: voucher.id,
                        voucher_number: voucher.voucher_number,
                        post_date: voucher.post_date
                    });
                    continue;
                }

                // Check if projection matches
                const voucherDetails = await this.db.query(`
                    SELECT account_code, entry_type, amount, dimensions
                    FROM voucher_details
                    WHERE voucher_id = $1
                `, [voucher.id]);

                let hasMismatch = false;

                for (const detail of voucherDetails.rows) {
                    if (!detail.dimensions || Object.keys(detail.dimensions).length === 0) continue;

                    const isDebit = detail.entry_type === 'DR';
                    const expectedAmount = parseFloat(detail.amount);

                    for (const [dimKey, dimVal] of Object.entries(detail.dimensions)) {
                        const projected = await this.db.query(`
                            SELECT debit_accumulated, credit_accumulated
                            FROM account_dimension_balances
                            WHERE company_id = $1
                              AND account_code = $2
                              AND dimension_key = $3
                              AND dimension_value = $4
                        `, [companyId, detail.account_code, dimKey, dimVal.toString()]);

                        if (projected.rows.length === 0) {
                            hasMismatch = true;
                            discrepancies.push({
                                type: 'MISSING_PROJECTION',
                                voucher_id: voucher.id,
                                account_code: detail.account_code,
                                dimension_key: dimKey,
                                dimension_value: dimVal
                            });
                        } else {
                            const actualDebit = parseFloat(projected.rows[0].debit_accumulated);
                            const actualCredit = parseFloat(projected.rows[0].credit_accumulated);
                            const actualAmount = isDebit ? actualDebit : actualCredit;

                            if (Math.abs(actualAmount - expectedAmount) > 0.01) {
                                hasMismatch = true;
                                discrepancies.push({
                                    type: 'AMOUNT_MISMATCH',
                                    voucher_id: voucher.id,
                                    account_code: detail.account_code,
                                    dimension_key: dimKey,
                                    dimension_value: dimVal,
                                    expected: expectedAmount,
                                    actual: actualAmount,
                                    difference: actualAmount - expectedAmount
                                });
                            }
                        }
                    }
                }

                if (hasMismatch) {
                    mismatchedVouchers++;
                } else {
                    projectedVouchers++;
                }
            }

            const consistencyRate = totalVouchers > 0 
                ? ((projectedVouchers / totalVouchers) * 100).toFixed(2)
                : 100;

            console.log(`[ProjectionEngine] Audit complete: ${consistencyRate}% consistent`);

            return {
                companyId,
                totalVouchers,
                projectedVouchers,
                unprojectedVouchers,
                mismatchedVouchers,
                consistencyRate: parseFloat(consistencyRate),
                discrepancies,
                auditedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('[ProjectionEngine] Error running consistency audit:', error);
            throw error;
        }
    }

    /**
     * Generate reconciliation report
     * @param {number} companyId - Company ID
     * @param {Object} filters - { fiscal_year, fiscal_period }
     */
    async generateReconciliationReport(companyId, filters = {}) {
        try {
            const { fiscal_year, fiscal_period } = filters;

            // Get summary statistics
            const summaryResult = await this.db.query(`
                SELECT 
                    COUNT(DISTINCT v.id) as total_vouchers,
                    COUNT(DISTINCT pl.voucher_id) as total_projected,
                    COUNT(DISTINCT adb.id) as total_projection_records,
                    SUM(adb.debit_accumulated) as total_debit,
                    SUM(adb.credit_accumulated) as total_credit
                FROM vouchers v
                LEFT JOIN projection_log pl ON v.id = pl.voucher_id AND pl.status = 'SUCCESS'
                LEFT JOIN account_dimension_balances adb ON v.company_id = adb.company_id
                WHERE v.company_id = $1
                  AND v.status = 'APPROVED'
                  ${fiscal_year ? 'AND EXTRACT(YEAR FROM v.post_date) = $2' : ''}
                  ${fiscal_period ? 'AND EXTRACT(MONTH FROM v.post_date) = $3' : ''}
            `, fiscal_year && fiscal_period ? [companyId, fiscal_year, fiscal_period] 
                : fiscal_year ? [companyId, fiscal_year] 
                : [companyId]);

            const summary = summaryResult.rows[0];
            const totalVouchers = parseInt(summary.total_vouchers || 0);
            const totalProjected = parseInt(summary.total_projected || 0);
            const consistencyRate = totalVouchers > 0 
                ? ((totalProjected / totalVouchers) * 100).toFixed(2)
                : 100;

            // Get dimension breakdown
            const dimensionBreakdown = await this.db.query(`
                SELECT 
                    dimension_key,
                    dimension_value,
                    COUNT(*) as record_count,
                    SUM(debit_accumulated) as total_debit,
                    SUM(credit_accumulated) as total_credit
                FROM account_dimension_balances
                WHERE company_id = $1
                GROUP BY dimension_key, dimension_value
                ORDER BY dimension_key, dimension_value
            `, [companyId]);

            // Get recent discrepancies
            const discrepancies = await this.db.query(`
                SELECT 
                    voucher_id,
                    projection_type,
                    status,
                    error_message,
                    processed_at
                FROM projection_log
                WHERE company_id = $1
                  AND status = 'FAILED'
                  AND processed_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                ORDER BY processed_at DESC
                LIMIT 100
            `, [companyId]);

            return {
                summary: {
                    totalVouchers,
                    totalProjected,
                    totalProjectionRecords: parseInt(summary.total_projection_records || 0),
                    consistencyRate: parseFloat(consistencyRate),
                    totalDebit: parseFloat(summary.total_debit || 0),
                    totalCredit: parseFloat(summary.total_credit || 0)
                },
                dimensionBreakdown: dimensionBreakdown.rows,
                recentFailures: discrepancies.rows,
                filters: { fiscal_year, fiscal_period },
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('[ProjectionEngine] Error generating reconciliation report:', error);
            throw error;
        }
    }

    /**
     * Get projection statistics
     */
    async getProjectionStats(companyId, days = 7) {
        try {
            const result = await this.db.query(`
                SELECT 
                    DATE(processed_at) as date,
                    status,
                    COUNT(*) as count,
                    AVG(EXTRACT(EPOCH FROM (processed_at - 
                        LAG(processed_at) OVER (ORDER BY processed_at)
                    ))) as avg_interval_seconds
                FROM projection_log
                WHERE company_id = $1
                  AND processed_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
                GROUP BY DATE(processed_at), status
                ORDER BY date DESC
            `, [companyId]);

            return result.rows;
        } catch (error) {
            console.error('[ProjectionEngine] Error getting projection stats:', error);
            return [];
        }
    }

    // ============================================================
    // BULK OPERATIONS (For initial data migration)
    // ============================================================

    /**
     * Re-project all approved vouchers (for initial setup or recovery)
     */
    async reprojectAllVouchers(companyId, limit = 1000) {
        try {
            console.log(`[ProjectionEngine] Starting full reprojection for company ${companyId}`);

            // Get all approved vouchers
            const vouchersResult = await this.db.query(`
                SELECT id
                FROM vouchers
                WHERE company_id = $1
                  AND status = 'APPROVED'
                ORDER BY post_date ASC
                LIMIT $2
            `, [companyId, limit]);

            console.log(`[ProjectionEngine] Found ${vouchersResult.rows.length} vouchers to reproject`);

            let successCount = 0;
            let failCount = 0;

            for (const voucher of vouchersResult.rows) {
                try {
                    await this.projectVoucher(voucher.id);
                    successCount++;
                } catch (error) {
                    console.error(`[ProjectionEngine] Failed to reproject voucher ${voucher.id}:`, error);
                    failCount++;
                }
            }

            console.log(`[ProjectionEngine] Reprojection complete: ${successCount} success, ${failCount} failed`);

            return {
                success: true,
                total: vouchersResult.rows.length,
                successCount,
                failCount
            };

        } catch (error) {
            console.error('[ProjectionEngine] Error during full reprojection:', error);
            throw error;
        }
    }
}

// ============================================================
// EXPORT SINGLETON
// ============================================================
let projectionEngineInstance = null;

export function getProjectionEngine(db, redis, queueService) {
    if (!projectionEngineInstance) {
        projectionEngineInstance = new ProjectionEngine(db, redis, queueService);
    }
    return projectionEngineInstance;
}