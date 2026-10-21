import AuditLog from '../models/AuditLog.js';

export const logAudit = async (actor, action, entity, entityId, meta = {}) => {
  try {
    const log = await AuditLog.create({
      actor,
      action,
      entity,
      entityId,
      meta
    });
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error.message);
    throw error;
  }
};

export default {
  logAudit
};
