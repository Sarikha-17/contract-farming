import { Router } from 'express';
import {
  servePhoto,
  markSeen,
  deletePhoto
} from '../controllers/photoController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';

const router = Router();

router.get('/:photoId/file', protect, servePhoto);
router.patch('/:photoId/seen', protect, authorize('buyer'), markSeen);
router.delete('/:photoId', protect, authorize('admin'), deletePhoto);

export default router;
