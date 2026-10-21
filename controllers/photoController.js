import fs from 'fs';
import path from 'path';
import FieldPhoto from '../models/FieldPhoto.js';
import { logAudit } from '../services/auditService.js';

export const servePhoto = async (req, res, next) => {
  try {
    const photo = await FieldPhoto.findById(req.params.photoId).populate('contract');
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    if (!photo.contract) {
      return res.status(404).json({
        success: false,
        message: 'Associated contract not found'
      });
    }

    const isFarmer =
      photo.contract.farmer?.toString() === req.user._id.toString();
    const isBuyer =
      photo.contract.buyer?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isFarmer && !isBuyer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this photo'
      });
    }

    const absolutePath = path.resolve(photo.filePath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: 'Photo file not found on disk'
      });
    }

    if (photo.mimeType) {
      res.setHeader('Content-Type', photo.mimeType);
    }

    return res.sendFile(absolutePath);
  } catch (error) {
    next(error);
  }
};

export const markSeen = async (req, res, next) => {
  try {
    const photo = await FieldPhoto.findById(req.params.photoId).populate('contract');
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    if (!photo.contract) {
      return res.status(404).json({
        success: false,
        message: 'Associated contract not found'
      });
    }

    if (photo.contract.buyer?.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the buyer for this contract can mark the photo as seen'
      });
    }

    photo.seenByBuyer = true;
    await photo.save();

    return res.status(200).json({
      success: true,
      message: 'Photo marked as seen',
      data: photo
    });
  } catch (error) {
    next(error);
  }
};

export const deletePhoto = async (req, res, next) => {
  try {
    const photo = await FieldPhoto.findById(req.params.photoId);
    if (!photo) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
    }

    const absolutePath = path.resolve(photo.filePath);
    if (fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch (err) {
        console.error('Error deleting photo file from disk:', err.message);
      }
    }

    await FieldPhoto.findByIdAndDelete(photo._id);

    await logAudit(
      req.user._id,
      'DELETE_PHOTO',
      'FieldPhoto',
      photo._id.toString(),
      {
        contract: photo.contract,
        filePath: photo.filePath
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
