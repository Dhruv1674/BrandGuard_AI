
import { Router } from 'express';
import multer from 'multer';

import {
  auditContent,
  getAudits,
  getAuditById,
  reviewFinding
} from '../controllers/auditController.js';

const router = Router();

const allowedTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf'
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1
  },
  fileFilter: (req, file, callback) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error('Only JPG, PNG, WEBP and PDF files are allowed.')
      );
    }

    callback(null, true);
  }
});

router.post('/check', upload.single('file'), auditContent);
router.get('/', getAudits);
router.get('/:auditId', getAuditById);
router.patch('/:auditId/findings/:findingId/review', reviewFinding);

export default router;
