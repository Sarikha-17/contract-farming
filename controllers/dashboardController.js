import Contract from '../models/Contract.js';
import Payment from '../models/Payment.js';
import Dispute from '../models/Dispute.js';
import FieldPhoto from '../models/FieldPhoto.js';
import CropUpdate from '../models/CropUpdate.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

export const getDashboardSummary = async (req, res, next) => {
  try {
    const { role } = req.user;

    if (role === 'farmer') {
      const contracts = await Contract.find({ farmer: req.user._id });
      const contractIds = contracts.map((c) => c._id);

      const activeContracts = contracts.filter((c) => c.status === 'active').length;

      const payments = await Payment.find({ contract: { $in: contractIds } });
      let totalPaymentsReceived = 0;
      let pendingPayments = 0;

      for (const p of payments) {
        if (p.status === 'paid') {
          totalPaymentsReceived += p.amount;
        } else if (p.status === 'pending') {
          pendingPayments += p.amount;
        }
      }

      const openDisputes = await Dispute.countDocuments({
        contract: { $in: contractIds },
        status: 'open'
      });

      const recentCropUpdates = await CropUpdate.find({
        contract: { $in: contractIds }
      })
        .populate('contract', 'contractId crop')
        .sort({ createdAt: -1 })
        .limit(5);

      return res.status(200).json({
        success: true,
        data: {
          role: 'farmer',
          activeContracts,
          totalContracts: contracts.length,
          totalPaymentsReceived: Math.round(totalPaymentsReceived * 100) / 100,
          pendingPayments: Math.round(pendingPayments * 100) / 100,
          openDisputes,
          recentCropUpdates
        }
      });
    }

    if (role === 'buyer') {
      const contracts = await Contract.find({ buyer: req.user._id });
      const contractIds = contracts.map((c) => c._id);

      const activeContracts = contracts.filter((c) => c.status === 'active').length;

      const payments = await Payment.find({ contract: { $in: contractIds } });
      let totalPaymentsReleased = 0;
      let pendingReleases = 0;

      for (const p of payments) {
        if (p.status === 'paid') {
          totalPaymentsReleased += p.amount;
        } else if (p.status === 'pending') {
          pendingReleases += p.amount;
        }
      }

      const openDisputes = await Dispute.countDocuments({
        contract: { $in: contractIds },
        status: 'open'
      });

      const unseenPhotosCount = await FieldPhoto.countDocuments({
        contract: { $in: contractIds },
        seenByBuyer: false
      });

      return res.status(200).json({
        success: true,
        data: {
          role: 'buyer',
          activeContracts,
          totalContracts: contracts.length,
          totalPaymentsReleased: Math.round(totalPaymentsReleased * 100) / 100,
          pendingReleases: Math.round(pendingReleases * 100) / 100,
          openDisputes,
          unseenPhotosCount
        }
      });
    }

    if (role === 'admin') {
      const [
        totalUsers,
        pendingVerifications,
        totalContracts,
        openDisputes,
        recentAuditLogs
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ verified: false }),
        Contract.countDocuments(),
        Dispute.countDocuments({ status: 'open' }),
        AuditLog.find()
          .populate('actor', 'name role')
          .sort({ createdAt: -1 })
          .limit(10)
      ]);

      return res.status(200).json({
        success: true,
        data: {
          role: 'admin',
          totalUsers,
          pendingVerifications,
          totalContracts,
          openDisputes,
          recentAuditLogs
        }
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Unknown user role'
    });
  } catch (error) {
    next(error);
  }
};
