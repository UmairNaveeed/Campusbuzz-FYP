import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const ConversationBlockedBy = sequelize.define(
    'ConversationBlockedBy',
    {
      conversationId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'conversation_id',
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'user_id',
      },
      blockedAt: {
        type: DataTypes.DATE,
        field: 'blocked_at',
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'conversation_blocked_by',
      underscored: true,
      timestamps: false,
    }
  );
  return ConversationBlockedBy;
}
