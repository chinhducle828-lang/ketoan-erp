/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiOrchestrator.service - AI Orchestrator
 * Central brain for cross-module AI communication and workflow intelligence
 */

import { askFinancialCopilot, solveMathProblem, analyzeWorkflow } from './aiCopilot.service.js';
import logger from '../utils/logger.js';

/**
 * Workflow definitions for accounting processes
 */
export const WORKFLOWS = {
  CLOSING: {
    id: 'closing',
    name: 'Kết sổ kỳ',
    nameEn: 'Period Closing',
    steps: [
      {
        id: 'check_revenue',
        name: 'Kiểm tra doanh thu',
        aiModule: 'journal',
        prompt: 'Kiểm tra tất cả các bút toán doanh thu trong kỳ, phát hiện bất thường'
      },
      {
        id: 'check_expenses',
        name: 'Kiểm tra chi phí',
        aiModule: 'journal',
        prompt: 'Kiểm tra tất cả các bút toán chi phí, phát hiện bút toán bất thường'
      },
      {
        id: 'reconcile',
        name: 'Đối chiếu công nợ',
        aiModule: 'copilot',
        prompt: 'Đối chiếu công nợ phải thu/phải trả, phát hiện chênh lệch'
      },
      {
        id: 'inventory_check',
        name: 'Kiểm kê kho',
        aiModule: 'inventory',
        prompt: 'Phân tích tồn kho, phát hiện hàng tồn lâu ngày'
      },
      {
        id: 'cashflow_review',
        name: 'Rà soát dòng tiền',
        aiModule: 'cashflow',
        prompt: 'Phân tích dòng tiền trong kỳ, đảm bảo cân đối'
      },
      {
        id: 'generate_report',
        name: 'Tạo báo cáo',
        aiModule: 'copilot',
        prompt: 'Tổng hợp tất cả kết quả và tạo báo cáo kết sổ'
      }
    ]
  },

  RECONCILIATION: {
    id: 'reconciliation',
    name: 'Đối chiếu',
    nameEn: 'Reconciliation',
    steps: [
      {
        id: 'bank_reconcile',
        name: 'Đối chiếu ngân hàng',
        aiModule: 'copilot',
        prompt: 'Đối chiếu số dư ngân hàng với sổ sách kế toán'
      },
      {
        id: 'vendor_reconcile',
        name: 'Đối chiếu nhà cung cấp',
        aiModule: 'copilot',
        prompt: 'Đối chiếu công nợ phải trả với nhà cung cấp'
      },
      {
        id: 'customer_reconcile',
        name: 'Đối chiếu khách hàng',
        aiModule: 'copilot',
        prompt: 'Đối chiếu công nợ phải thu với khách hàng'
      }
    ]
  },

  TAX_REPORT: {
    id: 'tax_report',
    name: 'Báo cáo thuế',
    nameEn: 'Tax Report',
    steps: [
      {
        id: 'calculate_vat',
        name: 'Tính thuế GTGT',
        aiModule: 'copilot',
        prompt: 'Tính tổng thuế GTGT đầu ra và đầu vào'
      },
      {
        id: 'calculate_tax',
        name: 'Tính thuế TNDN',
        aiModule: 'copilot',
        prompt: 'Tính thuế thu nhập doanh nghiệp'
      },
      {
        id: 'generate_tax_report',
        name: 'Tạo báo cáo thuế',
        aiModule: 'copilot',
        prompt: 'Tổng hợp và tạo báo cáo thuế theo mẫu'
      }
    ]
  },

  INVENTORY_AUDIT: {
    id: 'inventory_audit',
    name: 'Kiểm kê kho',
    nameEn: 'Inventory Audit',
    steps: [
      {
        id: 'analyze_stock',
        name: 'Phân tích tồn kho',
        aiModule: 'inventory',
        prompt: 'Phân tích tình hình tồn kho hiện tại'
      },
      {
        id: 'detect_anomalies',
        name: 'Phát hiện bất thường',
        aiModule: 'inventory',
        prompt: 'Phát hiện hàng tồn lâu ngày, hàng sắp hết hạn'
      },
      {
        id: 'suggest_adjustment',
        name: 'Đề xuất điều chỉnh',
        aiModule: 'inventory',
        prompt: 'Đề xuất điều chỉnh giá trị tồn kho'
      }
    ]
  }
};

/**
 * Execute a workflow with AI orchestration
 * @param {string} workflowType - Type of workflow (CLOSING, RECONCILIATION, etc.)
 * @param {string} companyId - Company ID
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} Workflow execution results
 */
export async function executeWorkflow(workflowType, companyId, context = {}) {
  try {
    const workflow = WORKFLOWS[workflowType];
    
    if (!workflow) {
      throw new Error(`Unknown workflow type: ${workflowType}`);
    }

    logger.info({ workflowType, companyId }, 'Starting AI workflow');

    const results = {
      workflowType,
      workflowName: workflow.name,
      companyId,
      startTime: new Date().toISOString(),
      steps: [],
      summary: null,
      recommendations: []
    };

    // Execute each step
    for (const step of workflow.steps) {
      logger.info({ step: step.id, workflowType }, 'Executing workflow step');

      try {
        const stepResult = await executeWorkflowStep(step, companyId, context, results);
        
        results.steps.push({
          stepId: step.id,
          stepName: step.name,
          status: 'completed',
          result: stepResult,
          timestamp: new Date().toISOString()
        });

        // Share context with next steps
        context.previousResults = context.previousResults || {};
        context.previousResults[step.id] = stepResult;

      } catch (error) {
        logger.error({ error: error.message, step: step.id }, 'Workflow step failed');
        
        results.steps.push({
          stepId: step.id,
          stepName: step.name,
          status: 'failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });

        // Continue with next steps even if one fails
        continue;
      }
    }

    // Generate final summary
    results.summary = await generateWorkflowSummary(workflow, results, companyId);
    results.endTime = new Date().toISOString();
    results.duration = new Date(results.endTime) - new Date(results.startTime);

    logger.info({ workflowType, companyId, duration: results.duration }, 'Workflow completed');

    return results;

  } catch (error) {
    logger.error({ error: error.message, workflowType, companyId }, 'Workflow execution failed');
    throw error;
  }
}

/**
 * Execute a single workflow step
 */
async function executeWorkflowStep(step, companyId, context, previousResults) {
  switch (step.aiModule) {
    case 'copilot':
      return await executeCopilotStep(step, companyId, context);
    
    case 'journal':
      return await executeJournalStep(step, companyId, context);
    
    case 'inventory':
      return await executeInventoryStep(step, companyId, context);
    
    case 'cashflow':
      return await executeCashflowStep(step, companyId, context);
    
    default:
      throw new Error(`Unknown AI module: ${step.aiModule}`);
  }
}

/**
 * Execute step using AI Copilot
 */
async function executeCopilotStep(step, companyId, context) {
  const question = step.prompt + (context.period ? ` (Kỳ: ${context.period})` : '');
  
  const result = await askFinancialCopilot(question, companyId);
  
  return {
    module: 'copilot',
    question,
    answer: result.answer,
    data: result.data,
    confidence: result.confidence
  };
}

/**
 * Execute step using AI Journal
 */
async function executeJournalStep(step, companyId, context) {
  // Import journal service
  const { analyzeLedger } = await import('./aiJournal.service.js');
  
  const result = await analyzeLedger(companyId, { period: context.period });
  
  return {
    module: 'journal',
    analysis: result.account_stats,
    anomalies: result.anomalies,
    confidence: 85
  };
}

/**
 * Execute step using AI Inventory
 */
async function executeInventoryStep(step, companyId, context) {
  const { predictInventoryNeeds } = await import('./aiInventory.service.js');
  
  const result = await predictInventoryNeeds(companyId);
  
  return {
    module: 'inventory',
    analysis: { predictions: result.predictions, alerts: result.alerts },
    recommendations: result.alerts,
    confidence: result.confidence
  };
}

/**
 * Execute step using AI Cashflow
 */
async function executeCashflowStep(step, companyId, context) {
  const { predictCashflow } = await import('./aiCashflow.service.js');
  
  const result = await predictCashflow(companyId, 30); // Last 30 days
  
  return {
    module: 'cashflow',
    analysis: { current_cash: result.current_cash, predictions: result.predictions },
    forecast: result.predictions,
    alerts: result.alerts,
    confidence: result.confidence
  };
}

/**
 * Generate workflow summary
 */
async function generateWorkflowSummary(workflow, results, companyId) {
  const completedSteps = results.steps.filter(s => s.status === 'completed');
  const failedSteps = results.steps.filter(s => s.status === 'failed');
  
  // Collect all results for summary
  const resultsSummary = completedSteps.map(step => ({
    step: step.stepName,
    result: step.result
  }));

  const prompt = `You are an AI assistant summarizing a ${workflow.name} workflow for a Vietnamese accounting system.

Workflow: ${workflow.name}
Company ID: ${companyId}

Completed Steps: ${completedSteps.length}/${results.steps.length}
${failedSteps.length > 0 ? `Failed Steps: ${failedSteps.length}` : ''}

Step Results:
${JSON.stringify(resultsSummary, null, 2)}

Instructions:
1. Provide a concise summary of the workflow execution
2. Highlight key findings and insights
3. List any issues or anomalies detected
4. Provide actionable recommendations
5. Format in Vietnamese, Markdown format

Summary:`;

  try {
    const { generateInsights } = await import('./geminiClient.js');
    const summary = await generateInsights([{ name: 'Workflow Results', data: resultsSummary }], prompt);
    
    return {
      text: summary.insights,
      confidence: summary.confidence,
      completedSteps: completedSteps.length,
      totalSteps: results.steps.length,
      successRate: (completedSteps.length / results.steps.length) * 100
    };
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to generate workflow summary');
    return {
      text: `Hoàn thành ${completedSteps.length}/${results.steps.length} bước`,
      confidence: 0,
      completedSteps: completedSteps.length,
      totalSteps: results.steps.length,
      successRate: (completedSteps.length / results.steps.length) * 100
    };
  }
}

/**
 * Get proactive AI insights for a company
 * @param {string} companyId - Company ID
 * @returns {Promise<Object>} Proactive insights
 */
export async function getProactiveInsights(companyId) {
  try {
    logger.info({ companyId }, 'Generating proactive insights');

    const insights = {
      companyId,
      generatedAt: new Date().toISOString(),
      categories: {}
    };

    // 1. Financial Health
    try {
      const financialQuestion = 'Phân tích sức khỏe tài chính tổng quan của công ty';
      const financialResult = await askFinancialCopilot(financialQuestion, companyId);
      insights.categories.financial = {
        status: 'completed',
        insight: financialResult.answer,
        confidence: financialResult.confidence
      };
    } catch (error) {
      logger.warn('Financial insight failed', error);
      insights.categories.financial = { status: 'failed', error: error.message };
    }

// 2. Inventory Alerts
    try {
      const { predictInventoryNeeds } = await import('./aiInventory.service.js');
      const inventoryResult = await predictInventoryNeeds(companyId);
      insights.categories.inventory = {
        status: 'completed',
        insight: { predictions: inventoryResult.predictions, alerts: inventoryResult.alerts },
        recommendations: inventoryResult.alerts,
        confidence: inventoryResult.confidence
      };
    } catch (error) {
      logger.warn('Inventory insight failed', error);
      insights.categories.inventory = { status: 'failed', error: error.message };
    }

    // 3. Cashflow Alerts
    try {
      const { predictCashflow } = await import('./aiCashflow.service.js');
      const cashflowResult = await predictCashflow(companyId, 30);
      insights.categories.cashflow = {
        status: 'completed',
        insight: { current_cash: cashflowResult.current_cash, predictions: cashflowResult.predictions },
        forecast: cashflowResult.predictions,
        alerts: cashflowResult.alerts,
        confidence: cashflowResult.confidence
      };
    } catch (error) {
      logger.warn('Cashflow insight failed', error);
      insights.categories.cashflow = { status: 'failed', error: error.message };
    }

    // 4. Journal Anomalies
    try {
      const { analyzeLedger } = await import('./aiJournal.service.js');
      const anomaliesResult = await analyzeLedger(companyId);
      insights.categories.anomalies = {
        status: 'completed',
        anomalies: anomaliesResult.anomalies,
        confidence: 85
      };
    } catch (error) {
      logger.warn('Anomaly detection failed', error);
      insights.categories.anomalies = { status: 'failed', error: error.message };
    }

    // 5. Generate overall summary
    try {
      const { generateInsights } = await import('./geminiClient.js');
      const dataSources = Object.entries(insights.categories)
        .filter(([_, cat]) => cat.status === 'completed')
        .map(([name, data]) => ({ name, data }));

      if (dataSources.length > 0) {
        const overallInsight = await generateInsights(
          dataSources,
          'Tổng hợp insights từ tất cả các module và đưa ra khuyến nghị hành động'
        );
        
        insights.overall = {
          summary: overallInsight.insights,
          confidence: overallInsight.confidence
        };
      }
    } catch (error) {
      logger.warn('Overall summary generation failed', error);
    }

    return insights;

  } catch (error) {
    logger.error({ error: error.message, companyId }, 'Failed to generate proactive insights');
    throw error;
  }
}

/**
 * Analyze cross-module correlations
 * @param {string} companyId - Company ID
 * @param {string} question - User's question
 * @returns {Promise<Object>} Cross-module analysis
 */
export async function analyzeCrossModule(companyId, question) {
  try {
    logger.info({ companyId, question }, 'Starting cross-module analysis');

    // Gather data from multiple modules
    const dataSources = [];

    // 1. Financial data
    try {
      const financialResult = await askFinancialCopilot(question, companyId);
      dataSources.push({
        name: 'Tài chính',
        data: financialResult.data || []
      });
    } catch (error) {
      logger.warn('Financial data fetch failed', error);
    }

// 2. Inventory data
    try {
      const { predictInventoryNeeds } = await import('./aiInventory.service.js');
      const inventoryResult = await predictInventoryNeeds(companyId);
      dataSources.push({
        name: 'Kho',
        data: { predictions: inventoryResult.predictions, alerts: inventoryResult.alerts } || {}
      });
    } catch (error) {
      logger.warn('Inventory data fetch failed', error);
    }

    // 3. Cashflow data
    try {
      const { predictCashflow } = await import('./aiCashflow.service.js');
      const cashflowResult = await predictCashflow(companyId, 30);
      dataSources.push({
        name: 'Dòng tiền',
        data: { current_cash: cashflowResult.current_cash, predictions: cashflowResult.predictions } || {}
      });
    } catch (error) {
      logger.warn('Cashflow data fetch failed', error);
    }

    // 4. Generate cross-module insights
    const { generateInsights } = await import('./geminiClient.js');
    const insights = await generateInsights(dataSources, question);

    return {
      question,
      insights: insights.insights,
      dataSources: dataSources.length,
      confidence: insights.confidence,
      model: insights.model
    };

  } catch (error) {
    logger.error({ error: error.message, companyId, question }, 'Cross-module analysis failed');
    throw error;
  }
}

export default {
  WORKFLOWS,
  executeWorkflow,
  getProactiveInsights,
  analyzeCrossModule
};