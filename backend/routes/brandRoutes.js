import { Router } from 'express';
import { createBrand, getBrands, getBrandById } from '../controllers/brandController.js';
const router = Router();
router.post('/', createBrand);
router.get('/', getBrands);
router.get('/:id', getBrandById);
export default router;
