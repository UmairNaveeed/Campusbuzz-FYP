import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const ConversationParticipant = sequelize.define(
    'ConversationParticipant',
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
      tableName: 'conversation_participants',
      underscored: true,
      timestamps: false,
    }
  );
  return ConversationParticipant;
}
