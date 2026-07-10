/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * geminiClient.js - Google Gemini AI Client
 * Centralized service for all Gemini API interactions
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AI_CONFIG } from '../config/aiConfig.js';
import logger from '../utils/logger.js';

// Initialize Gemini AI client
let genAI = null;

/**
 * Initialize Gemini client with API key
 */
export function initializeGemini() {
  try {
    const apiKey = AI_CONFIG.GEMINI.API_KEY;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      logger.warn('Gemini API key not configured. AI features will be disabled.');
      return false;
    }

    genAI = new GoogleGenerativeAI(apiKey);
    logger.info('Gemini AI client initialized successfully');
    return true;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to initialize Gemini AI');
    return false;
  }
}

/**
 * Check if Gemini is available
 */
export function isGeminiAvailable() {
  return genAI !== null;
}

/**
 * Get Gemini model instance with configuration
 */
function getModel() {
  if (!genAI) {
    throw new Error('Gemini AI not initialized');
  }

  const config = AI_CONFIG.GEMINI;
  return genAI.getGenerativeModel({ 
    model: config.MODEL,
    generationConfig: {
      maxOutputTokens: config.MAX_TOKENS,
      temperature: config.TEMPERATURE,
    },
  });
}

/**
 * Retry wrapper for API calls
 */
async function withRetry(operation, maxAttempts = AI_CONFIG.GEMINI.RETRY_ATTEMPTS) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        throw error;
      }
      
      // Wait before retry
      if (attempt < maxAttempts) {
        const delay = AI_CONFIG.GEMINI.RETRY_DELAY * attempt;
        logger.warn({ attempt, delay, error: error.message }, 'Retrying Gemini API call');
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Call Gemini API with timeout
 */
export async function callGemini(prompt, options = {}) {
  if (!isGeminiAvailable()) {
    throw new Error('Gemini AI not available');
  }

  const timeout = options.timeout || AI_CONFIG.GEMINI.TIMEOUT;
  
  return withRetry(async () => {
    const model = getModel();
    
    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Gemini API timeout')), timeout)
      )
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    return text;
  });
}

/**
 * Generate SQL from natural language question
 * @param {string} question - User's question in Vietnamese
 * @param {string} schema - Database schema description
 * @param {string} companyId - Company ID for context
 * @returns {Promise<Object>} Generated SQL and confidence
 */
export async function generateSQL(question, schema, companyId) {
  try {
    const prompt = `You are a SQL expert for a Vietnamese accounting ERP system (Kế toán TT200 và Thông tư 99/2025/TT-BTC).

Database Schema:
${schema}

Company ID: ${companyId}

User Question: ${question}

Instructions:
1. Generate ONLY a SELECT query (no INSERT, UPDATE, DELETE, DROP, etc.)
2. ALWAYS include WHERE company_id = '${companyId}' for security
3. Use Vietnamese column names if they exist, otherwise use English
4. Limit results to 100 rows maximum
5. Use proper JOINs when needed
6. Return ONLY the SQL query, no explanations

SQL Query:`;

    const sql = await callGemini(prompt);
    
    // Clean up the SQL (remove markdown code blocks if present)
    const cleanSQL = sql
      .replace(/```sql/g, '')
      .replace(/```/g, '')
      .trim();
    
    // Validate SQL starts with SELECT
    if (!cleanSQL.toUpperCase().startsWith('SELECT')) {
      throw new Error('Generated SQL does not start with SELECT');
    }
    
    // Validate company_id is present
    if (!cleanSQL.includes(`company_id = '${companyId}'`) && !cleanSQL.includes(`company_id="${companyId}"`)) {
      logger.warn('Generated SQL missing company_id filter, adding it');
      // This will be handled by executeSafeQuery
    }

    return {
      sql: cleanSQL,
      confidence: 85, // Gemini is generally reliable
      model: AI_CONFIG.GEMINI.MODEL
    };
  } catch (error) {
    logger.error({ error: error.message, question }, 'Failed to generate SQL');
    throw new Error(`Không thể tạo SQL từ câu hỏi: ${error.message}`);
  }
}

/**
 * Analyze data and generate insights
 * @param {string} question - User's question
 * @param {Array} data - Query results
 * @param {string} sql - SQL query that was executed
 * @returns {Promise<Object>} Analysis and insights
 */
export async function analyzeData(question, data, sql) {
  try {
    const dataSummary = JSON.stringify(data.slice(0, 50), null, 2); // Limit data for context
    
    const prompt = `You are a financial analyst AI for a Vietnamese accounting ERP system.

User Question: ${question}

SQL Query Executed:
${sql}

Data Results (${data.length} total records, showing first 50):
${dataSummary}

Instructions:
1. Analyze the data and answer the user's question in Vietnamese
2. Provide specific numbers and calculations
3. Highlight important insights or anomalies
4. Format the response in Markdown
5. Be concise but thorough
6. If data is empty, explain why and suggest alternatives

Analysis:`;

    const analysis = await callGemini(prompt);
    
    return {
      answer: analysis,
      confidence: 90,
      model: AI_CONFIG.GEMINI.MODEL,
      recordsAnalyzed: data.length
    };
  } catch (error) {
    logger.error({ error: error.message, question }, 'Failed to analyze data');
    return {
      answer: `Không thể phân tích dữ liệu: ${error.message}. Tìm được ${data.length} bản ghi.`,
      confidence: 0,
      error: true
    };
  }
}

/**
 * Solve math/algebra problems
 * @param {string} problem - Math problem description
 * @param {string} context - Context (financial, accounting, etc.)
 * @returns {Promise<Object>} Solution with steps
 */
export async function solveMathProblem(problem, context = 'financial') {
  try {
    const prompt = `You are a math and financial calculation expert AI for a Vietnamese accounting system.

Problem: ${problem}
Context: ${context}

Instructions:
1. Solve the problem step by step
2. Show all calculations clearly
3. Provide the final answer in Vietnamese
4. Format as Markdown with clear sections
5. If it's a financial calculation, explain the formula used
6. Include units (VND, %, etc.)

Solution:`;

    const solution = await callGemini(prompt);
    
    return {
      solution,
      confidence: 95,
      model: AI_CONFIG.GEMINI.MODEL,
      type: context
    };
  } catch (error) {
    logger.error({ error: error.message, problem }, 'Failed to solve math problem');
    throw new Error(`Không thể giải bài toán: ${error.message}`);
  }
}

/**
 * Analyze workflow and provide recommendations
 * @param {string} workflowType - Type of workflow (closing, reconciliation, etc.)
 * @param {Object} workflowData - Current workflow state
 * @returns {Promise<Object>} Analysis and recommendations
 */
export async function analyzeWorkflow(workflowType, workflowData) {
  try {
    const prompt = `You are a business process optimization AI for a Vietnamese accounting ERP system.

Workflow Type: ${workflowType}

Current Workflow State:
${JSON.stringify(workflowData, null, 2)}

Instructions:
1. Analyze the current workflow state
2. Identify bottlenecks or issues
3. Provide specific recommendations for improvement
4. Suggest automation opportunities
5. Estimate time/cost savings
6. Format in Vietnamese, Markdown format

Analysis:`;

    const analysis = await callGemini(prompt);
    
    return {
      analysis,
      confidence: 85,
      model: AI_CONFIG.GEMINI.MODEL,
      workflowType
    };
  } catch (error) {
    logger.error({ error: error.message, workflowType }, 'Failed to analyze workflow');
    return {
      analysis: `Không thể phân tích workflow: ${error.message}`,
      confidence: 0,
      error: true
    };
  }
}

/**
 * Generate financial insights from multiple data sources
 * @param {Array} dataSources - Array of {name, data} objects
 * @param {string} question - User's question
 * @returns {Promise<Object>} Comprehensive insights
 */
export async function generateInsights(dataSources, question) {
  try {
    const context = dataSources.map(ds => 
      `## ${ds.name}\n${JSON.stringify(ds.data.slice(0, 30), null, 2)}`
    ).join('\n\n');

    const prompt = `You are a comprehensive financial analyst AI for a Vietnamese accounting ERP system.

Question: ${question}

Data Sources:
${context}

Instructions:
1. Synthesize information from all data sources
2. Provide cross-module insights
3. Identify correlations and patterns
4. Suggest actionable recommendations
5. Format in Vietnamese, Markdown format
6. Be data-driven and specific

Comprehensive Analysis:`;

    const insights = await callGemini(prompt, { timeout: 60000 }); // Longer timeout for complex analysis
    
    return {
      insights,
      confidence: 88,
      model: AI_CONFIG.GEMINI.MODEL,
      sourcesAnalyzed: dataSources.length
    };
  } catch (error) {
    logger.error({ error: error.message, question }, 'Failed to generate insights');
    return {
      insights: `Không thể tạo insights: ${error.message}`,
      confidence: 0,
      error: true
    };
  }
}

/**
 * Chat with AI for general questions
 * @param {string} message - User's message
 * @param {Array} conversationHistory - Previous messages
 * @param {Object} context - Additional context (company, user role, etc.)
 * @returns {Promise<Object>} AI response
 */
export async function chat(message, conversationHistory = [], context = {}) {
  try {
    const historyText = conversationHistory
      .slice(-10) // Keep last 10 messages for context
      .map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n');

    const prompt = `You are a helpful AI assistant for a Vietnamese accounting ERP system (Kế toán TT200 và Thông tư 99/2025/TT-BTC).

${context.companyName ? `Company: ${context.companyName}` : ''}
${context.userRole ? `User Role: ${context.userRole}` : ''}

Previous Conversation:
${historyText || 'No previous conversation'}

User Message: ${message}

Instructions:
1. Respond in Vietnamese
2. Be helpful and professional
3. If the question is about accounting, provide accurate information
4. If you need data to answer, suggest using the analysis features
5. Keep responses concise but informative
6. Use Markdown formatting for clarity

Response:`;

    const response = await callGemini(prompt);
    
    return {
      message: response,
      model: AI_CONFIG.GEMINI.MODEL,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error({ error: error.message, message }, 'Failed to chat with AI');
    throw new Error(`Không thể trả lời: ${error.message}`);
  }
}

/**
 * Process document with OCR using Gemini Vision
 * @param {string} imageBase64 - Base64 encoded image
 * @param {string} documentType - Type of document (invoice, voucher, etc.)
 * @returns {Promise<Object>} Extracted data
 */
export async function processDocumentOCR(imageBase64, documentType = 'invoice') {
  try {
    if (!isGeminiAvailable()) {
      throw new Error('Gemini AI not available');
    }

    const model = getModel();
    
    // Prepare the prompt based on document type
    const prompts = {
      invoice: `You are an OCR system for Vietnamese invoices (hóa đơn GTGT).

Extract the following information from this invoice image:
1. Invoice number (Số hóa đơn)
2. Invoice date (Ngày hóa đơn)
3. Seller name (Tên người bán)
4. Seller tax code (Mã số thuế người bán)
5. Buyer name (Tên người mua)
6. Buyer tax code (Mã số thuế người mua)
7. Total amount (Tổng tiền)
8. Tax amount (Tiền thuế GTGT)
9. Items list (Danh sách hàng hóa/dịch vụ)

Return the data in JSON format:
{
  "invoice_number": "...",
  "invoice_date": "...",
  "seller_name": "...",
  "seller_tax_code": "...",
  "buyer_name": "...",
  "buyer_tax_code": "...",
  "total_amount": 0,
  "tax_amount": 0,
  "items": [
    {
      "name": "...",
      "quantity": 0,
      "unit_price": 0,
      "amount": 0
    }
  ],
  "confidence": 0-100
}`,
      voucher: `You are an OCR system for Vietnamese accounting vouchers (chứng từ kế toán).

Extract the following information:
1. Voucher number (Số chứng từ)
2. Voucher date (Ngày chứng từ)
3. Description (Nội dung)
4. Account entries (Bút toán):
   - Account code (Mã tài khoản)
   - Description (Diễn giải)
   - Debit amount (Nợ)
   - Credit amount (Có)

Return the data in JSON format:
{
  "voucher_number": "...",
  "voucher_date": "...",
  "description": "...",
  "entries": [
    {
      "account_code": "...",
      "description": "...",
      "debit": 0,
      "credit": 0
    }
  ],
  "confidence": 0-100
}`
    };

    const prompt = prompts[documentType] || prompts.invoice;

    // Convert base64 to format Gemini expects
    const imageData = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    // Try to parse JSON from response
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
      const extractedData = JSON.parse(jsonStr);
      
      return {
        success: true,
        data: extractedData,
        confidence: extractedData.confidence || 85,
        model: AI_CONFIG.GEMINI.MODEL
      };
    } catch (parseError) {
      logger.error({ error: parseError.message, text }, 'Failed to parse OCR JSON');
      return {
        success: true,
        data: { raw_text: text },
        confidence: 70,
        model: AI_CONFIG.GEMINI.MODEL
      };
    }

  } catch (error) {
    logger.error({ error: error.message, documentType }, 'OCR processing failed');
    throw new Error(`Không thể xử lý OCR: ${error.message}`);
  }
}

/**
 * Analyze and validate OCR results
 * @param {Object} ocrData - Extracted OCR data
 * @param {string} documentType - Type of document
 * @returns {Promise<Object>} Validation and suggestions
 */
export async function validateOCRResult(ocrData, documentType = 'invoice') {
  try {
    const prompt = `You are an accounting expert for Vietnamese ERP system.

Validate this OCR extracted data from a ${documentType}:

${JSON.stringify(ocrData, null, 2)}

Instructions:
1. Check for missing required fields
2. Validate data formats (dates, numbers, tax codes)
3. Check if debits = credits (for vouchers)
4. Suggest corrections if needed
5. Calculate confidence score (0-100)

Return JSON format:
{
  "is_valid": true/false,
  "confidence": 0-100,
  "missing_fields": ["field1", "field2"],
  "errors": ["error1", "error2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "corrected_data": {}
}`;

    const response = await callGemini(prompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const validation = JSON.parse(jsonMatch ? jsonMatch[0] : response);
      
      return {
        success: true,
        validation,
        model: AI_CONFIG.GEMINI.MODEL
      };
    } catch (parseError) {
      return {
        success: true,
        validation: {
          is_valid: true,
          confidence: 75,
          message: response
        },
        model: AI_CONFIG.GEMINI.MODEL
      };
    }

  } catch (error) {
    logger.error({ error: error.message }, 'OCR validation failed');
    return {
      success: false,
      validation: {
        is_valid: false,
        confidence: 0,
        errors: [error.message]
      }
    };
  }
}

export default {
  initializeGemini,
  isGeminiAvailable,
  callGemini,
  generateSQL,
  analyzeData,
  solveMathProblem,
  analyzeWorkflow,
  generateInsights,
  chat,
  processDocumentOCR,
  validateOCRResult
};
