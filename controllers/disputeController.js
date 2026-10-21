import Dispute from '../models/Dispute.js';
import Contract from '../models/Contract.js';
import User from '../models/User.js';
import { logAudit } from '../services/auditService.js';
import { notify } from '../services/notificationService.js';

export const createDispute = async (req, res, next) => {
  try {
    const { contractId, reason } = req.body;

    if (!contractId || !reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Contract ID and reason are required'
      });
    }

    const contract = await Contract.findById(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const isFarmer =
      contract.farmer.toString() === req.user._id.toString();
    const isBuyer =
      contract.buyer.toString() === req.user._id.toString();

    if (!isFarmer && !isBuyer) {
      return res.status(403).json({
        success: false,
        message: 'You can only raise disputes for contracts you are a party to'
      });
    }

    const existingDisputes = await Dispute.find({ disputeId: /^DSP-\d+$/ })
      .select('disputeId')
      .lean();

    let maxNum = 0;
    for (const d of existingDisputes) {
      const match = d.disputeId?.match(/^DSP-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
    const disputeId = `DSP-${String(maxNum + 1).padStart(4, '0')}`;

    const dispute = await Dispute.create({
      disputeId,
      contract: contract._id,
      raisedBy: req.user._id,
      reason: reason.trim(),
      status: 'open'
    });

    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await notify(
        admin._id,
        `New dispute ${disputeId} raised by ${req.user.name} on contract ${contract.contractId}`,
        'dispute_raised',
        `/disputes/${dispute._id}`
      );
    }

    await logAudit(
      req.user._id,
      'CREATE_DISPUTE',
      'Dispute',
      dispute._id.toString(),
      {
        disputeId,
        contractId: contract.contractId,
        reason: dispute.reason
      }
    );

    const populatedDispute = await Dispute.findById(dispute._id)
      .populate('contract', 'contractId crop status stage')
      .populate('raisedBy', 'name role phone');

    return res.status(201).json({
      success: true,
      message: 'Dispute raised successfully',
      data: populatedDispute
    });
  } catch (error) {
    next(error);
  }
};

export const getDisputes = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    let filter = {};

    if (req.user.role === 'admin') {
      // Admin sees all disputes
    } else {
      const userContracts = await Contract.find({
        $or: [{ farmer: req.user._id }, { buyer: req.user._id }]
      }).select('_id');

      const contractIds = userContracts.map((c) => c._id);
      filter = {
        $or: [
          { raisedBy: req.user._id },
          { contract: { $in: contractIds } }
        ]
      };
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const total = await Dispute.countDocuments(filter);
    const disputes = await Dispute.find(filter)
      .populate('contract', 'contractId crop status stage farmer buyer')
      .populate('raisedBy', 'name role phone')
      .populate('resolvedBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: disputes,
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

export const resolveDispute = async (req, res, next) => {
  try {
    const { resolutionNote } = req.body;
    if (!resolutionNote || !resolutionNote.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Resolution note is required'
      });
    }

    const dispute = await Dispute.findById(req.params.id).populate('contract');
    if (!dispute) {
      return res.status(404).json({
        success: false,
        message: 'Dispute not found'
      });
    }

    if (dispute.status === 'resolved') {
      return res.status(400).json({
        success: false,
        message: 'Dispute has already been resolved'
      });
    }

    dispute.status = 'resolved';
    dispute.resolutionNote = resolutionNote.trim();
    dispute.resolvedBy = req.user._id;
    dispute.resolvedAt = new Date();

    await dispute.save();

    if (dispute.contract) {
      const contract = dispute.contract;
      await notify(
        contract.farmer,
        `Dispute ${dispute.disputeId} on contract ${contract.contractId} has been resolved: ${dispute.resolutionNote}`,
        'dispute_resolved',
        `/contracts/${contract._id}`
      );
      await notify(
        contract.buyer,
        `Dispute ${dispute.disputeId} on contract ${contract.contractId} has been resolved: ${dispute.resolutionNote}`,
        'dispute_resolved',
        `/contracts/${contract._id}`
      );
    }

    await logAudit(
      req.user._id,
      'RESOLVE_DISPUTE',
      'Dispute',
      dispute._id.toString(),
      {
        disputeId: dispute.disputeId,
        resolutionNote: dispute.resolutionNote
      }
    );

    const populatedDispute = await Dispute.findById(dispute._id)
      .populate('contract', 'contractId crop status stage')
      .populate('raisedBy', 'name role phone')
      .populate('resolvedBy', 'name role');

    return res.status(200).json({
      success: true,
      message: 'Dispute resolved successfully',
      data: populatedDispute
    });
  } catch (error) {
    next(error);
  }
};
