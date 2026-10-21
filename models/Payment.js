import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    contract: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contract',
      required: [true, 'Contract reference is required'],
      index: true
    },
    milestone: {
      type: Number,
      min: 0,
      max: 2,
      required: [true, 'Milestone is required']
    },
    percent: {
      type: Number,
      required: [true, 'Percentage is required'],
      min: [0, 'Percent cannot be negative'],
      max: [100, 'Percent cannot exceed 100']
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'paid'],
        message: '{VALUE} is not a valid payment status'
      },
      default: 'pending'
    },
    paidAt: {
      type: Date
    },
    invoiceNo: {
      type: String,
      trim: true
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

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
