import mongoose from 'mongoose';

const disputeSchema = new mongoose.Schema(
  {
    disputeId: {
      type: String,
      unique: true,
      required: [true, 'Dispute ID is required'],
      trim: true,
      index: true
    },
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: [true, 'Contract reference is required'],
      index: true
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User who raised the dispute is required']
    },
    reason: {
      type: String,
      required: [true, 'Reason for dispute is required'],
      trim: true
    },
    status: {
      type: String,
      enum: {
        values: ['open', 'resolved'],
        message: '{VALUE} is not a valid dispute status'
      },
      default: 'open'
    },
    resolutionNote: {
      type: String,
      trim: true
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
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

const Dispute = mongoose.model('Dispute', disputeSchema);

export default Dispute;
