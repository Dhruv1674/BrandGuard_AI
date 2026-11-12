
import mongoose from 'mongoose';

const findingSchema = new mongoose.Schema({
  category: { type: String, default: 'General' },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  issue: { type: String, required: true },
  explanation: { type: String, required: true },
  guidelineReference: {
    type: String,
    default: 'No specific reference supplied'
  },
  evidenceStatus: {
    type: String,
    enum: ['supported', 'unsupported', 'contradicted', 'inconclusive'],
    default: 'inconclusive'
  },
  originalText: { type: String, default: '' },
  suggestedCorrection: { type: String, default: '' },
  reviewStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { _id: true });

const auditSchema = new mongoose.Schema({
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: true
  },

  sourceType: {
    type: String,
    enum: ['text', 'image', 'pdf'],
    default: 'text'
  },

  submittedContent: {
    type: String,
    default: '',
    maxlength: 20000
  },

  fileName: { type: String, default: '' },
  mimeType: { type: String, default: '' },
  fileSize: { type: Number, default: 0 },
  fileHash: { type: String, default: '' },

  overallStatus: {
    type: String,
    enum: ['compliant', 'needs_review', 'non_compliant'],
    required: true
  },

  summary: { type: String, required: true },
  findings: { type: [findingSchema], default: [] }
}, { timestamps: true });

auditSchema.index({ brand: 1, createdAt: -1 });

export default mongoose.model('Audit', auditSchema);
