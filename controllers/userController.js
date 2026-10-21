import User from '../models/User.js';
import { logAudit } from '../services/auditService.js';
import { notify } from '../services/notificationService.js';

export const getPendingUsers = async (req, res, next) => {
  try {
    const users = await User.find({ verified: false })
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

export const verifyUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.verified = true;
    await user.save();

    await notify(
      user._id,
      'Your account has been verified by the administrator.',
      'account_verified',
      '/profile'
    );

    await logAudit(
      req.user._id,
      'VERIFY_USER',
      'User',
      user._id.toString(),
      {
        phone: user.phone,
        role: user.role,
        name: user.name
      }
    );

    const safeUser = user.toObject();
    delete safeUser.passwordHash;

    return res.status(200).json({
      success: true,
      message: 'User verified successfully',
      data: safeUser
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.verified !== undefined) {
      filter.verified = req.query.verified === 'true';
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getFarmers = async (req, res, next) => {
  try {
    // Always read live from the database: every registered farmer is listed,
    // verified or not (the client labels unverified ones). Never cached.
    const farmers = await User.find({ role: 'farmer' })
      .select('_id name phone village verified')
      .sort({ name: 1 });

    res.set('Cache-Control', 'no-store');

    return res.status(200).json({
      success: true,
      data: farmers
    });
  } catch (error) {
    next(error);
  }
};
