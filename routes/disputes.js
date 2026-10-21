import { Router } from 'express';
import {
  createDispute,
  getDisputes,
  resolveDispute
} from '../controllers/disputeController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';

const router = Router();

router.post('/', protect, authorize('farmer', 'buyer'), createDispute);
router.get('/', protect, getDisputes);
router.patch('/:id/resolve', protect, authorize('admin'), resolveDispute);

export default router;
