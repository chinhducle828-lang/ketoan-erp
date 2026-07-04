import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { rebuildLedger } from '../services/maintenance.service.js';

const router = express.Router();

router.post('/rebuild-ledger/:companyId', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { startDate } = req.body;

    const result = await rebuildLedger(Number(companyId), startDate || '2000-01-01');
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
