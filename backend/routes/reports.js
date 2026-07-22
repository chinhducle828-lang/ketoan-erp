// ============================================================
// PHASE 5: CQRS READ PROJECTION - REPORTS API
// ============================================================
// Purpose: Fast financial reporting using pre-aggregated data
//          Query time: < 50ms (vs seconds on raw tables)
// ============================================================

import { Router } from 'express';
const router = Router();

// Import projection engine (will be initialized in server.js)
let projectionEngine = null;

// ============================================================
// INITIALIZATION
// ============================================================

export function initReportsRoutes(engine) {
    projectionEngine = engine;
    console.log('[ReportsRoutes] Initialized with ProjectionEngine');
}

// ============================================================
// MIDDLEWARE
// ============================================================

// Auth middleware (adjust based on your auth system)
const authenticate = (req, res, next) => {
    // TODO: Add proper authentication
    // For now, assume company_id is in req.user
    if (!req.user?.company_id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    req.company_id = req.user.company_id;
    next();
};

// ============================================================
// DIMENSION BALANCE QUERIES
// ============================================================

/**
 * GET /api/reports/dimension-balances
 * Get account balances filtered by dimensions
 * Query params:
 *   - fiscal_year: required
 *   - fiscal_period: optional (single period)
 *   - from_period: optional (range start)
 *   - to_period: optional (range end)
 *   - dimension_key: optional (e.g., 'project_id')
 *   - dimension_value: optional (e.g., 'P001')
 *   - account_code: optional
 */
router.get('/dimension-balances', authenticate, async (req, res) => {
    try {
        const {
            fiscal_year,
            fiscal_period,
            from_period,
            to_period,
            dimension_key,
            dimension_value,
            account_code
        } = req.query;

        if (!fiscal_year) {
            return res.status(400).json({ error: 'fiscal_year is required' });
        }

        const filters = {
            company_id: req.company_id,
            fiscal_year: parseInt(fiscal_year),
            fiscal_period: fiscal_period ? parseInt(fiscal_period) : null,
            dimension_key,
            dimension_value,
            account_code
        };

        // Check cache first
        const cacheKey = `dimension-balances:${JSON.stringify(filters)}`;
        const cached = await projectionEngine.getCachedReport(req.company_id, 'DIMENSION_BALANCES', filters);
        if (cached) {
            return res.json({
                ...cached,
                cached: true
            });
        }

        // Query from projection table
        const result = await projectionEngine.getDimensionBalances(filters);

        // Cache the result
        await projectionEngine.cacheReport(req.company_id, 'DIMENSION_BALANCES', filters, result, 300);

        res.json({
            ...result,
            cached: false
        });

    } catch (error) {
        console.error('[ReportsRoutes] Error getting dimension balances:', error);
        res.status(500).json({ error: 'Failed to get dimension balances', message: error.message });
    }
});

// ============================================================
// PROFIT & LOSS REPORT
// ============================================================

/**
 * GET /api/reports/profit-loss
 * Get P&L report filtered by dimensions
 * Query params:
 *   - year: required (fiscal year)
 *   - from_period: optional (default: 1)
 *   - to_period: optional (default: 12)
 *   - dimension_key: optional (e.g., 'project_id')
 *   - dimension_value: optional (e.g., 'P001')
 */
router.get('/profit-loss', authenticate, async (req, res) => {
    try {
        const {
            year,
            from_period = 1,
            to_period = 12,
            dimension_key,
            dimension_value
        } = req.query;

        if (!year) {
            return res.status(400).json({ error: 'year is required' });
        }

        const filters = {
            company_id: req.company_id,
            year: parseInt(year),
            from_period: parseInt(from_period),
            to_period: parseInt(to_period),
            dimension_key,
            dimension_value
        };

        // Check cache first
        const cached = await projectionEngine.getCachedReport(req.company_id, 'PROFIT_LOSS', filters);
        if (cached) {
            return res.json({
                ...cached,
                cached: true
            });
        }

        // Generate P&L report
        const result = await projectionEngine.getProfitLossByDimension(filters);

        // Cache the result (longer TTL for reports)
        await projectionEngine.cacheReport(req.company_id, 'PROFIT_LOSS', filters, result, 600);

        res.json({
            ...result,
            cached: false
        });

    } catch (error) {
        console.error('[ReportsRoutes] Error generating P&L report:', error);
        res.status(500).json({ error: 'Failed to generate P&L report', message: error.message });
    }
});

// ============================================================
// BALANCE SHEET REPORT
// ============================================================

/**
 * GET /api/reports/balance-sheet
 * Get Balance Sheet report filtered by dimensions
 * Query params:
 *   - year: required (fiscal year)
 *   - period: optional (default: 12, end of year)
 *   - dimension_key: optional (e.g., 'cost_center')
 *   - dimension_value: optional (e.g., 'CC01')
 */
router.get('/balance-sheet', authenticate, async (req, res) => {
    try {
        const {
            year,
            period = 12,
            dimension_key,
            dimension_value
        } = req.query;

        if (!year) {
            return res.status(400).json({ error: 'year is required' });
        }

        const filters = {
            company_id: req.company_id,
            year: parseInt(year),
            period: parseInt(period),
            dimension_key,
            dimension_value
        };

        // Check cache first
        const cached = await projectionEngine.getCachedReport(req.company_id, 'BALANCE_SHEET', filters);
        if (cached) {
            return res.json({
                ...cached,
                cached: true
            });
        }

        // Generate Balance Sheet
        const result = await projectionEngine.getBalanceSheetByDimension(filters);

        // Cache the result
        await projectionEngine.cacheReport(req.company_id, 'BALANCE_SHEET', filters, result, 600);

        res.json({
            ...result,
            cached: false
        });

    } catch (error) {
        console.error('[ReportsRoutes] Error generating Balance Sheet:', error);
        res.status(500).json({ error: 'Failed to generate Balance Sheet', message: error.message });
    }
});

// ============================================================
// TRIAL BALANCE
// ============================================================

/**
 * GET /api/reports/trial-balance
 * Get Trial Balance for a specific period
 * Query params:
 *   - year: required
 *   - period: required
 */
router.get('/trial-balance', authenticate, async (req, res) => {
    try {
        const { year, period } = req.query;

        if (!year || !period) {
            return res.status(400).json({ error: 'year and period are required' });
        }

        const filters = {
            company_id: req.company_id,
            year: parseInt(year),
            period: parseInt(period)
        };

        // Check cache first
        const cached = await projectionEngine.getCachedReport(req.company_id, 'TRIAL_BALANCE', filters);
        if (cached) {
            return res.json({
                ...cached,
                cached: true
            });
        }

        // Query trial balance
        const query = `
            SELECT 
                account_code,
                dimension_key,
                dimension_value,
                SUM(debit_accumulated) as total_debit,
                SUM(credit_accumulated) as total_credit,
                (SUM(debit_accumulated) - SUM(credit_accumulated)) as net_balance
            FROM account_dimension_balances
            WHERE company_id = $1
              AND fiscal_year = $2
              AND fiscal_period = $3
            GROUP BY account_code, dimension_key, dimension_value
            ORDER BY account_code
        `;

        const result = await projectionEngine.db.query(query, [
            req.company_id,
            parseInt(year),
            parseInt(period)
        ]);

        const report = {
            details: result.rows,
            summary: {
                totalDebit: result.rows.reduce((sum, row) => sum + parseFloat(row.total_debit), 0),
                totalCredit: result.rows.reduce((sum, row) => sum + parseFloat(row.total_credit), 0),
                isBalanced: Math.abs(
                    result.rows.reduce((sum, row) => sum + parseFloat(row.total_debit), 0) -
                    result.rows.reduce((sum, row) => sum + parseFloat(row.total_credit), 0)
                ) < 0.01
            },
            filters
        };

        // Cache the result
        await projectionEngine.cacheReport(req.company_id, 'TRIAL_BALANCE', filters, report, 300);

        res.json({
            ...report,
            cached: false
        });

    } catch (error) {
        console.error('[ReportsRoutes] Error generating Trial Balance:', error);
        res.status(500).json({ error: 'Failed to generate Trial Balance', message: error.message });
    }
});

// ============================================================
// CASH FLOW REPORT
// ============================================================

/**
 * GET /api/reports/cash-flow
 * Get Cash Flow report
 * Query params:
 *   - year: required
 *   - from_period: optional (default: 1)
 *   - to_period: optional (default: 12)
 */
router.get('/cash-flow', authenticate, async (req, res) => {
    try {
        const {
            year,
            from_period = 1,
            to_period = 12
        } = req.query;

        if (!year) {
            return res.status(400).json({ error: 'year is required' });
        }

        const filters = {
            company_id: req.company_id,
            year: parseInt(year),
            from_period: parseInt(from_period),
            to_period: parseInt(to_period)
        };

        // Check cache first
        const cached = await projectionEngine.getCachedReport(req.company_id, 'CASH_FLOW', filters);
        if (cached) {
            return res.json({
                ...cached,
                cached: true
            });
        }

        // Define cash flow account mappings
        const operatingAccounts = ['111', '112', '131', '211', '311', '321', '323', '324', '325', '326', '327', '328', '331', '332', '333', '334', '337', '338', '341', '342', '343', '344', '346', '347', '348', '349', '611', '612', '613', '614', '615', '616', '617', '618', '619', '621', '622', '623', '624', '625', '626', '627', '628', '629', '641', '642', '643', '644', '650', '651', '652', '653', '654', '655', '656', '657', '658', '659', '661', '662', '663', '664', '665', '666', '667', '668', '669'];
        const investingAccounts = ['200', '201', '202', '203', '204', '205', '206', '207', '208', '209', '210', '220', '221', '222', '223', '224', '225', '226', '227', '228', '229', '230', '240', '241', '242', '243', '244', '245', '246', '247', '248', '249', '260', '261', '262', '263', '264', '265', '266', '267', '268', '269', '280', '281', '282', '283', '284', '285', '286', '287', '288', '289'];
        const financingAccounts = ['311', '312', '313', '314', '315', '316', '317', '318', '319', '320', '330', '331', '332', '333', '334', '335', '336', '337', '338', '339', '340', '341', '342', '343', '344', '345', '346', '347', '348', '349', '411', '412', '413', '414', '415', '416', '417', '418', '419', '420', '421', '422', '423', '424', '425', '426', '427', '428', '429'];

        const query = `
            SELECT 
                account_code,
                SUM(debit_accumulated - credit_accumulated) as net_cash_flow
            FROM account_dimension_balances
            WHERE company_id = $1
              AND fiscal_year = $2
              AND fiscal_period BETWEEN $3 AND $4
              AND account_code = ANY($5::text[])
            GROUP BY account_code
            ORDER BY account_code
        `;

        const result = await projectionEngine.db.query(query, [
            req.company_id,
            year,
            from_period,
            to_period,
            [...operatingAccounts, ...investingAccounts, ...financingAccounts]
        ]);

        // Calculate cash flow sections
        let operatingCashFlow = 0;
        let investingCashFlow = 0;
        let financingCashFlow = 0;

        for (const row of result.rows) {
            const cashFlow = parseFloat(row.net_cash_flow);
            if (operatingAccounts.some(acc => row.account_code.startsWith(acc.substring(0, 3)))) {
                operatingCashFlow += cashFlow;
            } else if (investingAccounts.some(acc => row.account_code.startsWith(acc.substring(0, 3)))) {
                investingCashFlow += cashFlow;
            } else if (financingAccounts.some(acc => row.account_code.startsWith(acc.substring(0, 3)))) {
                financingCashFlow += cashFlow;
            }
        }

        const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

        const report = {
            details: result.rows,
            summary: {
                operatingCashFlow,
                investingCashFlow,
                financingCashFlow,
                netCashFlow
            },
            filters
        };

        // Cache the result
        await projectionEngine.cacheReport(req.company_id, 'CASH_FLOW', filters, report, 600);

        res.json({
            ...report,
            cached: false
        });

    } catch (error) {
        console.error('[ReportsRoutes] Error generating Cash Flow report:', error);
        res.status(500).json({ error: 'Failed to generate Cash Flow report', message: error.message });
    }
});

// ============================================================
// PROJECTION MANAGEMENT
// ============================================================

/**
 * POST /api/reports/reproject
 * Manually trigger reprojection for a company
 * Body: { company_id, limit? }
 */
router.post('/reproject', authenticate, async (req, res) => {
    try {
        const { company_id, limit = 1000 } = req.body;

        if (!company_id) {
            return res.status(400).json({ error: 'company_id is required' });
        }

        // Check if user has admin rights
        if (req.company_id !== company_id && !req.user?.is_admin) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const result = await projectionEngine.reprojectAllVouchers(company_id, limit);

        res.json({
            success: true,
            message: 'Reprojection completed',
            ...result
        });

    } catch (error) {
        console.error('[ReportsRoutes] Error during reprojection:', error);
        res.status(500).json({ error: 'Failed to reproject', message: error.message });
    }
});

/**
 * GET /api/reports/projection-stats
 * Get projection statistics for monitoring
 * Query params:
 *   - company_id: optional (default: current user's company)
 *   - days: optional (default: 7)
 */
router.get('/projection-stats', authenticate, async (req, res) => {
    try {
        const { company_id, days = 7 } = req.query;

        const targetCompanyId = company_id || req.company_id;

        const stats = await projectionEngine.getProjectionStats(targetCompanyId, days);

        res.json({
            company_id: targetCompanyId,
            days: parseInt(days),
            stats
        });

    } catch (error) {
        console.error('[ReportsRoutes] Error getting projection stats:', error);
        res.status(500).json({ error: 'Failed to get projection stats', message: error.message });
    }
});

/**
 * POST /api/reports/cleanup-logs
 * Clean up old projection logs (admin only)
 */
router.post('/cleanup-logs', authenticate, async (req, res) => {
    try {
        if (!req.user?.is_admin) {
            return res.status(403).json({ error: 'Forbidden - admin only' });
        }

        const deletedCount = await projectionEngine.cleanupOldProjectionLogs();

        res.json({
            success: true,
            deletedCount
        });

    } catch (error) {
        console.error('[ReportsRoutes] Error cleaning up logs:', error);
        res.status(500).json({ error: 'Failed to cleanup logs', message: error.message });
    }
});

// ============================================================
// EXPORT ROUTER
// ============================================================

export default router;