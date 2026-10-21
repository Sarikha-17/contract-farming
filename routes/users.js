import { Router } from 'express';
import {
  getPendingUsers,
  verifyUser,
  getAllUsers,
  getFarmers
} from '../controllers/userController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';

const router = Router();

router.get('/pending', protect, authorize('admin'), getPendingUsers);
router.get('/farmers', protect, authorize('buyer', 'admin'), getFarmers);
router.patch('/:id/verify', protect, authorize('admin'), verifyUser);
router.get('/', protect, authorize('admin'), getAllUsers);

export default router;
