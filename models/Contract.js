import mongoose from 'mongoose';

const signatureSchema = new mongoose.Schema(
  {
    signed: {
      type: Boolean,
      default: false
    },
    signedAt: {
      type: Date
    }
  },
  { _id: false }
);

const contractSchema = new mongoose.Schema(
  {
    contractId: {
      type: String,
      unique: true,
      required: [true, 'Contract ID is required'],
      trim: true,
      index: true
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Farmer is required']
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Buyer is required']
    },
    crop: {
      type: String,
      required: [true, 'Crop is required'],
      trim: true
    },
    quantityQuintals: {
      type: Number,
      required: [true, 'Quantity in quintals is required'],
      min: [0, 'Quantity must be positive']
    },
    pricePerQuintal: {
      type: Number,
      required: [true, 'Price per quintal is required'],
      min: [0, 'Price must be positive']
    },
    grade: {
      type: String,
      enum: {
        values: ['A', 'B', 'C'],
        message: '{VALUE} is not a valid grade'
      },
      required: [true, 'Grade is required']
    },
    deliveryDate: {
      type: Date,
      required: [true, 'Delivery date is required']
    },
    signedByFarmer: {
      type: signatureSchema,
      default: () => ({ signed: false })
    },
    signedByBuyer: {
      type: signatureSchema,
      default: () => ({ signed: false })
    },
    stage: {
      type: Number,
      min: 0,
      max: 3,
      default: 0
    },
    status: {
      type: String,
      enum: {
        values: ['awaiting_signature', 'active', 'completed', 'cancelled'],
        message: '{VALUE} is not a valid status'
      },
      default: 'awaiting_signature'
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

contractSchema.statics.getNextContractId = async function () {
  const contracts = await this.find({ contractId: /^CF-\d+$/ })
    .select('contractId')
    .lean();

  let maxNum = 0;
  for (const c of contracts) {
    const match = c.contractId?.match(/^CF-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `CF-${String(nextNum).padStart(4, '0')}`;
};

const Contract = mongoose.model('Contract', contractSchema);

export default Contract;
