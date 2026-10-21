import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  getMe,
  updateLanguage
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .bail()
    .matches(/^\d{10}$/)
    .withMessage('Phone number must be exactly 10 digits'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  // Self-registration as admin is not allowed
  body('role')
    .isIn(['farmer', 'buyer'])
    .withMessage('Role must be either farmer or buyer'),
  body('company')
    .if(body('role').equals('buyer'))
    .trim()
    .notEmpty()
    .withMessage('Company name is required for merchants')
];

const loginValidation = [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const languageValidation = [
  body('language').trim().notEmpty().withMessage('Language code is required')
];

router.post('/register', validate(registerValidation), register);
router.post('/login', validate(loginValidation), login);
router.get('/me', protect, getMe);
router.patch('/language', protect, validate(languageValidation), updateLanguage);

export default router;
