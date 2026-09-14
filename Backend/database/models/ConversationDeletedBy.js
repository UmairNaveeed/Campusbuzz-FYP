import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const ConversationDeletedBy = sequelize.define(
    'ConversationDeletedBy',
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
    },
    {
      tableName: 'conversation_deleted_by',
      underscored: true,
      timestamps: false,
    }
  );
  return ConversationDeletedBy;
}
