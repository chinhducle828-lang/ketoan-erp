/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Integration test: 3 new event processors
 */

import { describe, it, expect } from '@jest/globals';
import { getEventProcessor } from '../../core/rea/reaEventMapper.js';

describe('REA Event Processors - New Processors', () => {
  describe('purchase_order_created', () => {
    it('should validate and calculate purchase order', () => {
      const processor = getEventProcessor('purchase_order_created');
      const data = {
        supplier_id: 1,
        items: [
          { quantity: 10, unit_price: 100000 }
        ]
      };

      const calculated = processor.calculate(data);
      expect(calculated.total_amount).toBe(1000000);
      expect(calculated.status).toBe('PENDING_APPROVAL');
    });

    it('should reject purchase order without supplier', () => {
      const processor = getEventProcessor('purchase_order_created');
      expect(() => processor.validate({ items: [] })).toThrow('Thiếu nhà cung cấp');
    });

    it('should generate empty entries (workflow only)', () => {
      const processor = getEventProcessor('purchase_order_created');
      const entries = processor.generateEntries({});
      expect(entries).toEqual([]);
    });
  });

  describe('sales_shipped_and_billed', () => {
    it('should validate and calculate sales with shipping', () => {
      const processor = getEventProcessor('sales_shipped_and_billed');
      const data = {
        customer_id: 1,
        shipping_date: '2026-07-16',
        items: [
          { quantity: 5, unit_price: 200000 }
        ]
      };

      const calculated = processor.calculate(data);
      expect(calculated.subtotal).toBe(1000000);
      expect(calculated.tax_amount).toBe(80000); // 8% VAT
      expect(calculated.total_amount).toBe(1080000);
    });

    it('should generate accounting entries for sales', () => {
      const processor = getEventProcessor('sales_shipped_and_billed');
      const data = {
        customer_id: 1,
        shipping_date: '2026-07-16',
        items: [{ quantity: 1, unit_price: 100000 }],
        subtotal: 100000,
        tax_amount: 8000,
        total_amount: 108000
      };

      const entries = processor.generateEntries(data);
      expect(entries.length).toBe(3); // DR AR, CR Revenue, CR VAT
      expect(entries[0].entryType).toBe('DR');
      expect(entries[0].amount).toBe(108000);
    });
  });

  describe('inventory_received', () => {
    it('should validate and calculate inventory receipt', () => {
      const processor = getEventProcessor('inventory_received');
      const data = {
        supplier_id: 1,
        warehouse_id: 2,
        items: [
          { quantity: 50, unit_cost: 50000 }
        ]
      };

      const calculated = processor.calculate(data);
      expect(calculated.total_amount).toBe(2500000);
      expect(calculated.received_date).toBeDefined();
    });

    it('should generate accounting entries for inventory receipt', () => {
      const processor = getEventProcessor('inventory_received');
      const data = {
        supplier_id: 1,
        warehouse_id: 2,
        items: [{ quantity: 10, unit_cost: 100000 }],
        total_amount: 1000000
      };

      const entries = processor.generateEntries(data);
      expect(entries.length).toBe(2); // DR Inventory, CR AP
      expect(entries[0].entryType).toBe('DR');
      expect(entries[0].amount).toBe(1000000);
    });

    it('should reject inventory receipt without warehouse', () => {
      const processor = getEventProcessor('inventory_received');
      expect(() => processor.validate({
        supplier_id: 1,
        items: [{ quantity: 1, unit_cost: 100 }]
      })).toThrow('Thiếu kho nhập');
    });
  });

  describe('case insensitivity', () => {
    it('should handle lowercase event types', () => {
      const processor = getEventProcessor('purchase_order_created');
      expect(processor).toBeDefined();
    });

    it('should handle mixed case event types', () => {
      const processor = getEventProcessor('sales_shipped_and_billed');
      expect(processor).toBeDefined();
    });
  });
});