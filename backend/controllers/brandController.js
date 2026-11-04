import Brand from '../models/Brand.js';

export async function createBrand(req, res, next) {
  try {
    const { name, description, toneOfVoice, rules, approvedFacts, approvedTerms, prohibitedTerms } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Brand name is required.' });
    }
    const brand = await Brand.create({ name: name.trim(), description, toneOfVoice, rules, approvedFacts, approvedTerms, prohibitedTerms });
    return res.status(201).json({ success: true, message: 'Brand created successfully.', brand });
  } catch (error) { return next(error); }
}

export async function getBrands(req, res, next) {
  try {
    const brands = await Brand.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, count: brands.length, brands });
  } catch (error) { return next(error); }
}

export async function getBrandById(req, res, next) {
  try {
    const brand = await Brand.findById(req.params.id).lean();
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found.' });
    return res.json({ success: true, brand });
  } catch (error) { return next(error); }
}
