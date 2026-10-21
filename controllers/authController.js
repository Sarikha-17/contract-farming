import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import User from '../models/User.js';

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

export const register = async (req, res, next) => {
  try {
    const { name, phone, password, role, language, village, company } = req.body;

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this phone number already exists',
        errors: [
          { field: 'phone', message: 'A user with this phone number already exists' }
        ]
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      phone,
      passwordHash,
      role,
      language: language || 'en',
      village: role === 'farmer' ? village : undefined,
      company: role === 'buyer' ? company : undefined,
      // AUTO_VERIFY_USERS=true marks new accounts verified (demo mode)
      verified: config.autoVerifyUsers
    });

    const token = generateToken(user);

    const userResponse = {
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      language: user.language,
      village: user.village,
      company: user.company,
      verified: user.verified,
      documents: user.documents,
      createdAt: user.createdAt
    };

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone number or password'
      });
    }

    const token = generateToken(user);

    const userResponse = {
      _id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      language: user.language,
      village: user.village,
      company: user.company,
      verified: user.verified,
      documents: user.documents,
      createdAt: user.createdAt
    };

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: userResponse
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

export const updateLanguage = async (req, res, next) => {
  try {
    const { language } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { language },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    return res.status(200).json({
      success: true,
      message: 'Language updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};
