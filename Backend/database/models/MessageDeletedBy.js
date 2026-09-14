import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const MessageDeletedBy = sequelize.define(
    'MessageDeletedBy',
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
      tableName: 'message_deleted_by',
      underscored: true,
      timestamps: false,
    }
  );
  return MessageDeletedBy;
}
