import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor is required'],
      index: true
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true
    },
    entity: {
      type: String,
      required: [true, 'Entity is required'],
      trim: true
    },
    entityId: {
      type: String,
      required: [true, 'Entity ID is required'],
      trim: true
    },
    meta: {
      type: mongoose.Schema.Types.Mixed
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

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
