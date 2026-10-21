import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import Contract from '../models/Contract.js';
import User from '../models/User.js';
import Payment from '../models/Payment.js';
import CropUpdate from '../models/CropUpdate.js';
import FieldPhoto from '../models/FieldPhoto.js';
import { logAudit } from '../services/auditService.js';
import { notify } from '../services/notificationService.js';
import { processPayment } from '../services/paymentService.js';

export const createContract = async (req, res, next) => {
  try {
    if (!req.user.verified) {
      return res.status(403).json({
        success: false,
        message: 'Only verified buyers can create contracts'
      });
    }

    const {
      farmer: farmerId,
      crop,
      quantityQuintals,
      pricePerQuintal,
      grade,
      deliveryDate
    } = req.body;

    const farmer = await User.findById(farmerId);
    if (!farmer || farmer.role !== 'farmer') {
      return res.status(400).json({
        success: false,
        message: 'Farmer not found or invalid role'
      });
    }

    // An unverified farmer may be selected here; they simply cannot sign the
    // contract until the admin verifies them (enforced in signContract).

    const contractId = await Contract.getNextContractId();
    const qty = Number(quantityQuintals);
    const price = Number(pricePerQuintal);
    const totalAmount = qty * price;

    const contract = await Contract.create({
      contractId,
      farmer: farmer._id,
      buyer: req.user._id,
      crop: crop.trim(),
      quantityQuintals: qty,
      pricePerQuintal: price,
      grade: grade || 'A',
      deliveryDate: new Date(deliveryDate),
      signedByBuyer: {
        signed: true,
        signedAt: new Date()
      },
      signedByFarmer: {
        signed: false
      },
      stage: 0,
      status: 'awaiting_signature'
    });

    const milestoneConfigs = [
      { milestone: 0, percent: 30 },
      { milestone: 1, percent: 40 },
      { milestone: 2, percent: 30 }
    ];

    const paymentDocs = milestoneConfigs.map((m) => ({
      contract: contract._id,
      milestone: m.milestone,
      percent: m.percent,
      amount: Math.round(((totalAmount * m.percent) / 100) * 100) / 100,
      status: 'pending'
    }));

    const payments = await Payment.insertMany(paymentDocs);

    await notify(
      farmer._id,
      `New contract ${contract.contractId} for ${contract.crop} proposed by ${req.user.company || req.user.name}`,
      'contract_created',
      `/contracts/${contract._id}`
    );

    await logAudit(
      req.user._id,
      'CREATE_CONTRACT',
      'Contract',
      contract._id.toString(),
      {
        contractId: contract.contractId,
        farmer: farmer._id,
        buyer: req.user._id,
        crop: contract.crop,
        totalAmount
      }
    );

    return res.status(201).json({
      success: true,
      message: 'Contract created successfully',
      data: {
        ...contract.toObject(),
        payments
      },
      contract,
      payments
    });
  } catch (error) {
    next(error);
  }
};

export const getContracts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.user.role === 'farmer') {
      filter.farmer = req.user._id;
    } else if (req.user.role === 'buyer') {
      filter.buyer = req.user._id;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const total = await Contract.countDocuments(filter);
    const contracts = await Contract.find(filter)
      .populate('farmer', 'name phone village')
      .populate('buyer', 'name phone company')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: contracts,
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

export const getContract = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate('farmer', 'name phone village')
      .populate('buyer', 'name phone company');

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const isFarmer = contract.farmer._id
      ? contract.farmer._id.toString() === req.user._id.toString()
      : contract.farmer.toString() === req.user._id.toString();
    const isBuyer = contract.buyer._id
      ? contract.buyer._id.toString() === req.user._id.toString()
      : contract.buyer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isFarmer && !isBuyer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this contract'
      });
    }

    return res.status(200).json({
      success: true,
      data: contract
    });
  } catch (error) {
    next(error);
  }
};

export const signContract = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to sign the contract'
      });
    }

    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const isFarmer = contract.farmer.toString() === req.user._id.toString();
    const isBuyer = contract.buyer.toString() === req.user._id.toString();

    if (!isFarmer && !isBuyer) {
      return res.status(403).json({
        success: false,
        message: 'Only parties to this contract can sign it'
      });
    }

    if (!req.user.verified) {
      return res.status(403).json({
        success: false,
        message: 'Your account must be verified by the admin before you can sign contracts'
      });
    }

    if (contract.status !== 'awaiting_signature') {
      return res.status(400).json({
        success: false,
        message: `Contract is ${contract.status} and can no longer be signed`
      });
    }

    const user = await User.findById(req.user._id);
    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Signature verification failed.'
      });
    }

    if (isFarmer) {
      if (contract.signedByFarmer?.signed) {
        return res.status(400).json({
          success: false,
          message: 'Contract already signed by farmer'
        });
      }
      contract.signedByFarmer = {
        signed: true,
        signedAt: new Date()
      };
    } else if (isBuyer) {
      if (contract.signedByBuyer?.signed) {
        return res.status(400).json({
          success: false,
          message: 'Contract already signed by buyer'
        });
      }
      contract.signedByBuyer = {
        signed: true,
        signedAt: new Date()
      };
    }

    const bothSigned =
      Boolean(contract.signedByFarmer?.signed) &&
      Boolean(contract.signedByBuyer?.signed);

    if (bothSigned) {
      contract.status = 'active';

      await notify(
        contract.buyer,
        `Contract ${contract.contractId} has been signed by both parties and is now active. Milestone 0 payment is now pending.`,
        'contract_activated',
        `/contracts/${contract._id}`
      );

      await notify(
        contract.farmer,
        `Contract ${contract.contractId} has been fully signed and is now active.`,
        'contract_activated',
        `/contracts/${contract._id}`
      );
    }

    await contract.save();

    await logAudit(
      req.user._id,
      'SIGN_CONTRACT',
      'Contract',
      contract._id.toString(),
      {
        contractId: contract.contractId,
        party: isFarmer ? 'farmer' : 'buyer',
        bothSigned
      }
    );

    const populatedContract = await Contract.findById(contract._id)
      .populate('farmer', 'name phone village')
      .populate('buyer', 'name phone company');

    return res.status(200).json({
      success: true,
      message: 'Contract signed successfully',
      data: populatedContract
    });
  } catch (error) {
    next(error);
  }
};

export const advanceStage = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    if (contract.farmer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the farmer assigned to this contract can advance its stage'
      });
    }

    if (contract.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Can only advance stage for active contracts'
      });
    }

    const nextStage = contract.stage + 1;
    if (nextStage > 3) {
      return res.status(400).json({
        success: false,
        message: 'Contract is already at the final stage (Delivered)'
      });
    }

    if (req.body.stage !== undefined && Number(req.body.stage) !== nextStage) {
      return res.status(400).json({
        success: false,
        message: `Stage can only advance by 1 step. Next stage must be ${nextStage}`
      });
    }

    const stageNames = ['Sowing', 'Growing', 'Harvest', 'Delivered'];
    contract.stage = nextStage;

    const note =
      req.body.note && req.body.note.trim()
        ? req.body.note.trim()
        : `Stage advanced to stage ${nextStage} (${stageNames[nextStage] || nextStage})`;

    const cropUpdate = await CropUpdate.create({
      contract: contract._id,
      stage: nextStage,
      note,
      createdBy: req.user._id
    });

    if (contract.stage === 3) {
      const pendingCount = await Payment.countDocuments({
        contract: contract._id,
        status: { $ne: 'paid' }
      });
      if (pendingCount === 0) {
        contract.status = 'completed';
      }
    }

    await contract.save();

    await notify(
      contract.buyer,
      `Contract ${contract.contractId} advanced to stage ${nextStage} (${stageNames[nextStage] || nextStage})`,
      'stage_advanced',
      `/contracts/${contract._id}`
    );

    await logAudit(
      req.user._id,
      'ADVANCE_STAGE',
      'Contract',
      contract._id.toString(),
      {
        contractId: contract.contractId,
        stage: nextStage,
        note
      }
    );

    return res.status(200).json({
      success: true,
      message: `Stage advanced to ${stageNames[nextStage] || nextStage}`,
      data: contract,
      update: cropUpdate
    });
  } catch (error) {
    next(error);
  }
};

export const getCropUpdates = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const isFarmer = contract.farmer.toString() === req.user._id.toString();
    const isBuyer = contract.buyer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isFarmer && !isBuyer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view crop updates for this contract'
      });
    }

    const updates = await CropUpdate.find({ contract: contract._id })
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: updates
    });
  } catch (error) {
    next(error);
  }
};

export const uploadPhoto = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    if (contract.farmer.toString() !== req.user._id.toString()) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: 'Only the farmer assigned to this contract can upload photos'
      });
    }

    if (contract.status !== 'active') {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Photos can only be uploaded for active contracts'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Photo file is required'
      });
    }

    const { fileTypeFromFile } = await import('file-type');
    const detectedType = await fileTypeFromFile(req.file.path);
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!detectedType || !allowedMimeTypes.includes(detectedType.mime)) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed'
      });
    }

    let location;
    if (req.body.lat !== undefined && req.body.lng !== undefined) {
      location = {
        lat: Number(req.body.lat),
        lng: Number(req.body.lng)
      };
    } else if (req.body.location) {
      try {
        location =
          typeof req.body.location === 'string'
            ? JSON.parse(req.body.location)
            : req.body.location;
      } catch (e) {
        location = undefined;
      }
    }

    const stage =
      req.body.stage !== undefined ? Number(req.body.stage) : contract.stage;

    const photo = await FieldPhoto.create({
      contract: contract._id,
      stage,
      note: req.body.note ? req.body.note.trim() : '',
      filePath: req.file.path,
      mimeType: detectedType.mime,
      size: req.file.size,
      location,
      uploadedBy: req.user._id,
      takenAt: req.body.takenAt ? new Date(req.body.takenAt) : new Date(),
      seenByBuyer: false
    });

    await notify(
      contract.buyer,
      `New field photo uploaded for contract ${contract.contractId}`,
      'photo_uploaded',
      `/contracts/${contract._id}/photos`
    );

    await logAudit(
      req.user._id,
      'UPLOAD_PHOTO',
      'FieldPhoto',
      photo._id.toString(),
      {
        contractId: contract.contractId,
        photoId: photo._id,
        stage
      }
    );

    return res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: photo
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkErr) {
        // ignore
      }
    }
    next(error);
  }
};

export const getPhotos = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const isFarmer = contract.farmer.toString() === req.user._id.toString();
    const isBuyer = contract.buyer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isFarmer && !isBuyer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view photos for this contract'
      });
    }

    const filter = { contract: contract._id };
    if (req.query.stage !== undefined && req.query.stage !== '') {
      filter.stage = Number(req.query.stage);
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip = (page - 1) * limit;
    const sortOrder = req.query.sort === 'asc' ? 1 : -1;

    const total = await FieldPhoto.countDocuments(filter);
    const photos = await FieldPhoto.find(filter)
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit);

    let unseenCount = 0;
    if (req.user.role === 'buyer') {
      unseenCount = await FieldPhoto.countDocuments({
        contract: contract._id,
        seenByBuyer: false
      });
    }

    return res.status(200).json({
      success: true,
      data: photos,
      unseenCount,
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

export const getPayments = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const isFarmer = contract.farmer.toString() === req.user._id.toString();
    const isBuyer = contract.buyer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isFarmer && !isBuyer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view payments for this contract'
      });
    }

    const payments = await Payment.find({ contract: contract._id }).sort({
      milestone: 1
    });

    return res.status(200).json({
      success: true,
      data: payments
    });
  } catch (error) {
    next(error);
  }
};

export const releaseMilestone = async (req, res, next) => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    if (contract.buyer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the buyer of this contract can release payments'
      });
    }

    const milestone = parseInt(req.params.milestone, 10);
    if (isNaN(milestone) || milestone < 0 || milestone > 2) {
      return res.status(400).json({
        success: false,
        message: 'Invalid milestone number. Must be 0, 1, or 2'
      });
    }

    const payment = await Payment.findOne({
      contract: contract._id,
      milestone
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: `Milestone ${milestone} payment document not found`
      });
    }

    if (payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: `Milestone ${milestone} has already been paid`
      });
    }

    if (milestone === 0) {
      if (contract.status !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Contract must be active (signed by both parties) to release Milestone 0'
        });
      }
    } else if (milestone === 1) {
      if (contract.stage < 2) {
        return res.status(400).json({
          success: false,
          message: 'Contract stage must be at least Harvest (stage 2) to release Milestone 1'
        });
      }
    } else if (milestone === 2) {
      if (contract.stage < 3) {
        return res.status(400).json({
          success: false,
          message: 'Contract stage must be Delivered (stage 3) to release Milestone 2'
        });
      }
    }

    if (milestone > 0) {
      const priorUnpaid = await Payment.findOne({
        contract: contract._id,
        milestone: { $lt: milestone },
        status: { $ne: 'paid' }
      });

      if (priorUnpaid) {
        return res.status(400).json({
          success: false,
          message: `Cannot release Milestone ${milestone}. Prior Milestone ${priorUnpaid.milestone} must be paid first.`
        });
      }
    }

    await processPayment(payment);

    const otherPending = await Payment.countDocuments({
      contract: contract._id,
      _id: { $ne: payment._id },
      status: { $ne: 'paid' }
    });

    if (otherPending === 0 && contract.stage === 3) {
      contract.status = 'completed';
      await contract.save();
    }

    await notify(
      contract.farmer,
      `Milestone ${milestone} payment of ₹${payment.amount} released for contract ${contract.contractId}`,
      'payment_released',
      `/contracts/${contract._id}/payments`
    );

    await logAudit(
      req.user._id,
      'RELEASE_PAYMENT',
      'Payment',
      payment._id.toString(),
      {
        contractId: contract.contractId,
        milestone,
        amount: payment.amount,
        invoiceNo: payment.invoiceNo
      }
    );

    return res.status(200).json({
      success: true,
      message: `Milestone ${milestone} payment released successfully`,
      data: payment,
      contractStatus: contract.status
    });
  } catch (error) {
    next(error);
  }
};
