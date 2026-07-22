/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * transactionClassification.js - Frontend service for transaction classification
 */

import api from './api.js';

/**
 * Classify a transaction using the 3-layer classifier
 * @param {Object} content - Transaction content to classify
 * @returns {Promise<Object>} Classification result
 */
export const classifyTransaction = async (content) => {
  try {
    const response = await api.post('/transaction-classification/classify', { content });
    return response.data;
  } catch (error) {
    console.error('Transaction classification failed:', error);
    throw error;
  }
};

/**
 * Get all classification rules for the company
 * @returns {Promise<Array>} List of rules
 */
export const getClassificationRules = async () => {
  try {
    const response = await api.get('/transaction-classification/rules');
    return response.data.data;
  } catch (error) {
    console.error('Failed to get classification rules:', error);
    throw error;
  }
};

/**
 * Create a new classification rule
 * @param {Object} rule - Rule data
 * @returns {Promise<Object>} Created rule
 */
export const createClassificationRule = async (rule) => {
  try {
    const response = await api.post('/transaction-classification/rules', rule);
    return response.data.data;
  } catch (error) {
    console.error('Failed to create classification rule:', error);
    throw error;
  }
};

/**
 * Update a classification rule
 * @param {number} id - Rule ID
 * @param {Object} rule - Updated rule data
 * @returns {Promise<Object>} Updated rule
 */
export const updateClassificationRule = async (id, rule) => {
  try {
    const response = await api.put(`/transaction-classification/rules/${id}`, rule);
    return response.data.data;
  } catch (error) {
    console.error('Failed to update classification rule:', error);
    throw error;
  }
};

/**
 * Delete a classification rule
 * @param {number} id - Rule ID
 * @returns {Promise<Object>} Deleted rule
 */
export const deleteClassificationRule = async (id) => {
  try {
    const response = await api.delete(`/transaction-classification/rules/${id}`);
    return response.data.data;
  } catch (error) {
    console.error('Failed to delete classification rule:', error);
    throw error;
  }
};

/**
 * Record user feedback on classification
 * @param {number} classificationId - Classification ID
 * @param {boolean} isAccepted - Whether the classification was accepted
 * @returns {Promise<Object>} Updated classification
 */
export const recordClassificationFeedback = async (classificationId, isAccepted) => {
  try {
    const response = await api.post('/transaction-classification/feedback', {
      classification_id: classificationId,
      is_accepted: isAccepted
    });
    return response.data.data;
  } catch (error) {
    console.error('Failed to record classification feedback:', error);
    throw error;
  }
};

export default {
  classifyTransaction,
  getClassificationRules,
  createClassificationRule,
  updateClassificationRule,
  deleteClassificationRule,
  recordClassificationFeedback
};