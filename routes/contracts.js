import { Router } from 'express';
import { body } from 'express-validator';
import {
  createContract,
  getContracts,
  getContract,
  signContract,
  advanceStage,
  getCropUpdates,
  uploadPhoto,
  getPhotos,
  getPayments,
  releaseMilestone
} from '../controllers/contractController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import upload from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const contractValidation = [
  body('farmer').trim().notEmpty().withMessage('Farmer ID is required'),
  body('crop').trim().notEmpty().withMessage('Crop name is required'),
  body('quantityQuintals')
    .isFloat({ min: 0.01 })
    .withMessage('Quantity must be greater than 0'),
  body('pricePerQuintal')
    .isFloat({ min: 0.01 })
    .withMessage('Price per quintal must be greater than 0'),
  body('grade')
    .optional()
    .isIn(['A', 'B', 'C'])
    .withMessage('Grade must be A, B, or C'),
  body('deliveryDate').notEmpty().withMessage('Delivery date is required')
];

router.post(
  '/',
  protect,
  authorize('buyer'),
  validate(contractValidation),
  createContract
);
router.get('/', protect, getContracts);
router.get('/:id', protect, getContract);
router.patch('/:id/sign', protect, signContract);
router.post('/:id/stage', protect, authorize('farmer'), advanceStage);
router.get('/:id/updates', protect, getCropUpdates);
router.post(
  '/:id/photos',
  protect,
  authorize('farmer'),
  upload.single('photo'),
  uploadPhoto
);
router.get('/:id/photos', protect, getPhotos);
router.get('/:id/payments', protect, getPayments);
router.post(
  '/:id/payments/:milestone/release',
  protect,
  authorize('buyer'),
  releaseMilestone
);

export default router;
