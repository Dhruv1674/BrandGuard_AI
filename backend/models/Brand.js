import mongoose from 'mongoose';

const ruleSchema = new mongoose.Schema({
  category: { type: String, trim: true, default: 'General' },
  rule: { type: String, required: true, trim: true },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
}, { _id: true });

const factSchema = new mongoose.Schema({
  fact: { type: String, required: true, trim: true },
  source: { type: String, trim: true, default: 'Not supplied' }
}, { _id: true });

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 1000 },
  toneOfVoice: { type: String, default: '', maxlength: 1000 },
  rules: { type: [ruleSchema], default: [] },
  approvedFacts: { type: [factSchema], default: [] },
  approvedTerms: { type: [String], default: [] },
  prohibitedTerms: { type: [String], default: [] }
}, { timestamps: true });

export default mongoose.model('Brand', brandSchema);
