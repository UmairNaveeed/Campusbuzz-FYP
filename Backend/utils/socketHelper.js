// Socket.io helper to emit events from controllers
let ioInstance = null;
let userSocketsMap = null;

export const setSocketInstance = (io, userSockets) => {
  ioInstance = io;
  userSocketsMap = userSockets;
};

export const emitNewMessage = async (message, senderFirebaseId, recipientFirebaseId) => {
  if (!ioInstance || !userSocketsMap) {
    console.warn('Socket instance not initialized');
    return;
  }

  try {
    // Emit to recipient
    const recipientSocketId = userSocketsMap.get(recipientFirebaseId);
    if (recipientSocketId) {
      ioInstance.to(recipientSocketId).emit('dm:new_message', {
        message,
        conversation: message.conversation,
      });
      ioInstance.to(recipientSocketId).emit('notification', {
        type: 'new_message',
        message: `New message from ${message.sender?.name || 'Someone'}`,
      });
    }

    // Confirm to sender
    const senderSocketId = userSocketsMap.get(senderFirebaseId);
    if (senderSocketId) {
      ioInstance.to(senderSocketId).emit('dm:message_sent', {
        message,
      });
    }
  } catch (error) {
    console.error('Error emitting new message event:', error);
  }
};

export const emitMessageDeleted = async (conversationId, messageId, recipientFirebaseId) => {
  if (!ioInstance || !userSocketsMap) return;
  try {
    const recipientSocketId = userSocketsMap.get(recipientFirebaseId);
    if (recipientSocketId) {
      ioInstance.to(recipientSocketId).emit('dm:message_deleted', {
        conversationId,
        messageId,
      });
    }
  } catch (error) {
    console.error('Error emitting message deleted event:', error);
  }
};
