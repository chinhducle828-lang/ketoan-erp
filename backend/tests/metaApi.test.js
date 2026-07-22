/**
 * Test for Meta API - UI Schema endpoint
 * Verifies that the 'dynamic' entity type returns a valid schema
 */

import { describe, it, expect, jest } from '@jest/globals';

// Mock the database pool before importing the service
const mockQuery = jest.fn();
jest.mock('../config/db.js', () => ({
  pool: {
    query: mockQuery
  }
}));

// Mock businessRules
jest.mock('../config/businessRules.js', () => ({
  getUISchemaConfig: () => ({
    rea_subtypes: {
      'dynamic': {
        layout: { columns: 2, sections: ['Thông tin chung'] },
        fields: [
          { id: 'description', label: 'Mô tả', type: 'TEXT', section: 'Thông tin chung' }
        ]
      },
      'factoring': {
        layout: { columns: 2, sections: ['Thông tin chung'] },
        fields: [
          { id: 'partner_id', label: 'Ngân hàng', type: 'SELECT', section: 'Thông tin chung' }
        ]
      }
    }
  })
}));

import { getUISchema, getGridColumns } from '../services/metaApi.service.js';

describe('Meta API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockClear();
  });

  describe('getUISchema', () => {
    it('should return a schema for "dynamic" entity type from config', async () => {
      // Mock empty database result (no custom schema in rea_meta)
      mockQuery.mockResolvedValue({ rows: [] });
      
      const schema = await getUISchema('dynamic', 1);
      
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('layout');
      expect(schema).toHaveProperty('fields');
      expect(schema.fields.length).toBeGreaterThan(0);
    });

    it('should return a schema for "factoring" entity type from config', async () => {
      // Mock empty database result (no custom schema in rea_meta)
      mockQuery.mockResolvedValue({ rows: [] });
      
      const schema = await getUISchema('factoring', 1);
      
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('layout');
      expect(schema).toHaveProperty('fields');
    });

    it('should return custom schema from database when available', async () => {
      // Mock database result with custom schema
      const customSchema = {
        layout: { columns: 1, sections: ['Custom'] },
        fields: [{ id: 'custom_field', label: 'Custom', type: 'TEXT' }]
      };
      mockQuery.mockResolvedValue({ 
        rows: [{ ui_schema: customSchema }] 
      });
      
      const schema = await getUISchema('dynamic', 1);
      
      expect(schema).toEqual(customSchema);
    });

    it('should return null for unknown entity types', async () => {
      // Mock empty database result
      mockQuery.mockResolvedValue({ rows: [] });
      
      const schema = await getUISchema('unknown_entity', 1);
      
      expect(schema).toBeNull();
    });
  });

  describe('getGridColumns', () => {
    it('should return default columns when no custom columns in database', async () => {
      // Mock empty database result
      mockQuery.mockResolvedValue({ rows: [] });
      
      const columns = await getGridColumns('dynamic', 1);
      
      expect(Array.isArray(columns)).toBe(true);
      expect(columns.length).toBeGreaterThan(0);
      expect(columns[0]).toHaveProperty('key');
      expect(columns[0]).toHaveProperty('title');
    });

    it('should return custom columns from database when available', async () => {
      const customColumns = [
        { key: 'id', title: 'ID', sortable: true },
        { key: 'name', title: 'Name' }
      ];
      mockQuery.mockResolvedValue({ 
        rows: [{ grid_columns: customColumns }] 
      });
      
      const columns = await getGridColumns('dynamic', 1);
      
      expect(columns).toEqual(customColumns);
    });
  });
});
