import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const MessageReadBy = sequelize.define(
    'MessageReadBy',
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
      readAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'read_at',
      },
    },
    {
      tableName: 'message_read_by',
      underscored: true,
      timestamps: false,
    }
  );
  return MessageReadBy;
}
