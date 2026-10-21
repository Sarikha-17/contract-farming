import mongoose from 'mongoose';

const cropUpdateSchema = new mongoose.Schema(
  {
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: [true, 'Contract reference is required'],
      index: true
    },
    stage: {
      type: Number,
      required: [true, 'Crop stage is required']
    },
    note: {
      type: String,
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required']
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

const CropUpdate = mongoose.model('CropUpdate', cropUpdateSchema);

export default CropUpdate;
