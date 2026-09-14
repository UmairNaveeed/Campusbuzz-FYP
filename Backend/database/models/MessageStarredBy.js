import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const MessageStarredBy = sequelize.define(
    'MessageStarredBy',
    {
      messageId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'message_id',
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'user_id',
      },
    },
    {
      tableName: 'message_starred_by',
      underscored: true,
      timestamps: false,
    }
  );
  return MessageStarredBy;
}
