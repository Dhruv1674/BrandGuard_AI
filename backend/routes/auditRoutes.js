import { Router } from 'express';
import { auditContent, getAudits, getAuditById, reviewFinding } from '../controllers/auditController.js';
const router = Router();
router.post('/check', auditContent);
router.get('/', getAudits);
router.get('/:auditId', getAuditById);
router.patch('/:auditId/findings/:findingId/review', reviewFinding);
export default router;
