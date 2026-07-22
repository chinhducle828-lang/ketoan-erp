/**
 * ValidationBuilder.js - Xây dựng Zod schema từ JSON config fields
 * Dùng cho DynamicForm validation
 */

import { z } from 'zod';

/**
 * Xây dựng Zod schema từ mảng fields config
 * @param {Array} fields - Mảng field config từ UI Schema
 * @returns {Object} Zod object schema
 */
export function buildZodSchema(fields) {
  if (!fields || !Array.isArray(fields)) return z.object({});

  const shape = {};

  fields.forEach(field => {
    let validator;

    switch (field.type) {
      case 'TEXT':
        validator = z.string();
        if (field.maxLength) validator = validator.max(field.maxLength);
        if (field.pattern) validator = validator.regex(new RegExp(field.pattern));
        break;

      case 'NUMBER':
      case 'CURRENCY':
      case 'PERCENT':
        validator = z.coerce.number();
        if (field.min !== undefined) validator = validator.min(field.min);
        if (field.max !== undefined) validator = validator.max(field.max);
        break;

      case 'SELECT':
      case 'SELECT_COMPANY':
      case 'SELECT_CURRENCY':
        validator = z.union([z.string(), z.number()]);
        // Nếu có options (enum), validate giá trị phải nằm trong list
        if (field.options && field.options.length > 0) {
          const validValues = field.options
            .map(o => o.value)
            .filter(v => v !== undefined && v !== null && v !== '');
          if (validValues.length > 0) {
            validator = z.union([
              z.string().refine(
                v => v === '' || validValues.includes(v),
                { message: `${field.label || field.id} phải là một trong các giá trị hợp lệ` }
              ),
              z.number().refine(
                v => validValues.includes(String(v)),
                { message: `${field.label || field.id} phải là một trong các giá trị hợp lệ` }
              )
            ]);
          }
        }
        break;

      case 'DATE':
        validator = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không đúng định dạng YYYY-MM-DD');
        break;

      case 'RADIO':
        validator = z.union([z.boolean(), z.string(), z.number()]);
        break;

      case 'SUB_GRID':
        validator = z.array(
          z.object(
            (field.subFields || []).reduce((acc, sf) => {
              let subValidator;
              if (['NUMBER', 'CURRENCY', 'PERCENT'].includes(sf.type)) {
                subValidator = z.coerce.number();
                if (sf.min !== undefined) subValidator = subValidator.min(sf.min);
                if (sf.max !== undefined) subValidator = subValidator.max(sf.max);
              } else if (sf.type === 'SELECT_ITEM') {
                subValidator = z.union([z.string(), z.number()]);
              } else {
                subValidator = z.string();
              }
              acc[sf.id] = sf.required ? subValidator : subValidator.optional();
              return acc;
            }, {})
          )
        );
        if (field.minItems) validator = validator.min(field.minItems);
        break;

      default:
        validator = z.any();
    }

    if (field.required && field.type !== 'SUB_GRID') {
      validator = validator.refine(
        v => v !== undefined && v !== null && v !== '',
        { message: `${field.label || field.id} là bắt buộc` }
      );
    }

    shape[field.id] = field.required ? validator : validator.optional();
  });

  return z.object(shape);
}