import Notification from '../models/Notification.js';

export const notify = async (userId, message, type, link = '') => {
  try {
    const notification = await Notification.create({
      user: userId,
      message,
      type,
      link
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    throw error;
  }
};

export default {
  notify
};
