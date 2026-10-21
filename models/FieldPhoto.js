import mongoose from 'mongoose';

const fieldPhotoSchema = new mongoose.Schema(
  {
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: [true, 'Contract reference is required'],
      index: true
    },
    stage: {
      type: Number,
      required: [true, 'Stage is required']
    },
    note: {
      type: String,
      trim: true
    },
    filePath: {
      type: String,
      required: [true, 'File path is required']
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required']
    },
    size: {
      type: Number,
      required: [true, 'File size is required']
    },
    location: {
      lat: { type: Number },
      lng: { type: Number }
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader is required']
    },
    takenAt: {
      type: Date,
      default: Date.now
    },
    seenByBuyer: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

const FieldPhoto = mongoose.model('FieldPhoto', fieldPhotoSchema);

export default FieldPhoto;
