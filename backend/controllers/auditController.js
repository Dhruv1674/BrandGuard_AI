import mongoose from 'mongoose';
import Brand from '../models/Brand.js';
import Audit from '../models/Audit.js';
import { analyzeContent } from '../services/auditService.js';

export async function auditContent(req, res, next) {
  try {
    const { brandId, content } = req.body;
    if (!mongoose.isValidObjectId(brandId)) return res.status(400).json({ success: false, message: 'A valid brandId is required.' });
    if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ success: false, message: 'Content is required.' });
    if (content.length > 20000) return res.status(400).json({ success: false, message: 'Content must be 20,000 characters or fewer.' });

    const brand = await Brand.findById(brandId);
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found.' });

    const result = await analyzeContent(brand, content.trim());
    const audit = await Audit.create({
      brand: brand._id,
      submittedContent: content.trim(),
      overallStatus: result.overallStatus,
      summary: result.summary,
      findings: result.findings
    });
    return res.status(201).json({ success: true, message: 'Content audit completed.', audit });
  } catch (error) { return next(error); }
}

export async function getAudits(req, res, next) {
  try {
    const filter = {};
    if (req.query.brandId) {
      if (!mongoose.isValidObjectId(req.query.brandId)) return res.status(400).json({ success: false, message: 'Invalid brandId.' });
      filter.brand = req.query.brandId;
    }
    const audits = await Audit.find(filter).populate('brand', 'name').sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ success: true, count: audits.length, audits });
  } catch (error) { return next(error); }
}

export async function getAuditById(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.auditId)) return res.status(400).json({ success: false, message: 'Invalid audit ID.' });
    const audit = await Audit.findById(req.params.auditId).populate('brand', 'name');
    if (!audit) return res.status(404).json({ success: false, message: 'Audit not found.' });
    return res.json({ success: true, audit });
  } catch (error) { return next(error); }
}

export async function reviewFinding(req, res, next) {
  try {
    const { auditId, findingId } = req.params;
    const { decision } = req.body;
    if (!mongoose.isValidObjectId(auditId)) return res.status(400).json({ success: false, message: 'Invalid audit ID.' });
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'decision must be approved or rejected.' });
    const audit = await Audit.findById(auditId);
    if (!audit) return res.status(404).json({ success: false, message: 'Audit not found.' });
    const finding = audit.findings.id(findingId);
    if (!finding) return res.status(404).json({ success: false, message: 'Finding not found.' });
    finding.reviewStatus = decision;
    await audit.save();
    return res.json({ success: true, message: `Finding ${decision}.`, audit });
  } catch (error) { return next(error); }
}
