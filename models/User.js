import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const documentSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    filePath: {
      type: String,
      required: true,
      trim: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true
    },
    phone: {
      type: String,
      required: [true, 'Please provide a phone number'],
      unique: true,
      trim: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Please provide a password hash']
    },
    role: {
      type: String,
      enum: {
        values: ['farmer', 'buyer', 'admin'],
        message: '{VALUE} is not a valid role'
      },
      required: [true, 'Please specify a role']
    },
    language: {
      type: String,
      default: 'en',
      trim: true
    },
    village: {
      type: String,
      trim: true
    },
    company: {
      type: String,
      trim: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    documents: [documentSchema],
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

export default User;
