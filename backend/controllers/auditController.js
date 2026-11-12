
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';

import Brand from '../models/Brand.js';
import Audit from '../models/Audit.js';
import {
  analyzeContent,
  analyzeFile
} from '../services/auditService.js';

function isValidFileSignature(file) {
  const buffer = file.buffer;

  if (file.mimetype === 'image/jpeg') {
    return buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
  }

  if (file.mimetype === 'image/png') {
    return buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
  }

  if (file.mimetype === 'image/webp') {
    return buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
  }

  if (file.mimetype === 'application/pdf') {
    return buffer.toString('ascii', 0, 5) === '%PDF-';
  }

  return false;
}

export async function auditContent(req, res, next) {
  try {
    const { brandId, content } = req.body;
    const file = req.file;

    if (!mongoose.isValidObjectId(brandId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid brandId is required.'
      });
    }

    if (!file && (typeof content !== 'string' || !content.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Enter content or upload an image/PDF.'
      });
    }

    if (!file && content.length > 20000) {
      return res.status(400).json({
        success: false,
        message: 'Content must be 20,000 characters or fewer.'
      });
    }

    if (file && !isValidFileSignature(file)) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded file does not match its file type.'
      });
    }

    const brand = await Brand.findById(brandId);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found.'
      });
    }

    let result;
    let sourceType = 'text';
    let submittedContent = content?.trim() || '';

    const fileMetadata = {};

    if (file) {
      sourceType = file.mimetype === 'application/pdf' ? 'pdf' : 'image';

      result = await analyzeFile(brand, file);

      const safeFileName =
        file.originalname.split(/[\\/]/).pop().slice(0, 200);

      Object.assign(fileMetadata, {
        fileName: safeFileName,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileHash: createHash('sha256')
          .update(file.buffer)
          .digest('hex')
      });

      submittedContent = `Uploaded ${sourceType}: ${safeFileName}`;
    } else {
      result = await analyzeContent(brand, submittedContent);
    }

    const audit = await Audit.create({
      brand: brand._id,
      sourceType,
      submittedContent,
      ...fileMetadata,
      overallStatus: result.overallStatus,
      summary: result.summary,
      findings: result.findings
    });

    return res.status(201).json({
      success: true,
      message: 'Content audit completed.',
      audit
    });
  } catch (error) {
    return next(error);
  }
}

export async function getAudits(req, res, next) {
  try {
    const filter = {};

    if (req.query.brandId) {
      if (!mongoose.isValidObjectId(req.query.brandId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid brandId.'
        });
      }

      filter.brand = req.query.brandId;
    }

    const audits = await Audit.find(filter)
      .populate('brand', 'name')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      count: audits.length,
      audits
    });
  } catch (error) {
    return next(error);
  }
}

export async function getAuditById(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.auditId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audit ID.'
      });
    }

    const audit = await Audit.findById(req.params.auditId)
      .populate('brand', 'name');

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Audit not found.'
      });
    }

    return res.json({ success: true, audit });
  } catch (error) {
    return next(error);
  }
}

export async function reviewFinding(req, res, next) {
  try {
    const { auditId, findingId } = req.params;
    const { decision } = req.body;

    if (!mongoose.isValidObjectId(auditId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audit ID.'
      });
    }

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'decision must be approved or rejected.'
      });
    }

    const audit = await Audit.findById(auditId);

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Audit not found.'
      });
    }

    const finding = audit.findings.id(findingId);

    if (!finding) {
      return res.status(404).json({
        success: false,
        message: 'Finding not found.'
      });
    }

    finding.reviewStatus = decision;
    await audit.save();

    return res.json({
      success: true,
      message: `Finding ${decision}.`,
      audit
    });
  } catch (error) {
    return next(error);
  }
}
