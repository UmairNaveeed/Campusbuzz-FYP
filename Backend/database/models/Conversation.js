import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const Conversation = sequelize.define(
    'Conversation',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      lastMessageId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'last_message_id',
      },
      lastMessageAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_message_at',
      },
      status: {
        type: DataTypes.ENUM('pending', 'accepted'),
        defaultValue: 'accepted',
      },
      requestedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'requested_by_id',
      },
      acceptedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'accepted_at',
      },
      isGroup: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_group',
      },
      groupName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'group_name',
      },
      groupPhoto: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'group_photo',
      },
    },
    {
      tableName: 'conversations',
      underscored: true,
      timestamps: true,
    }
  );
  Conversation.prototype.toJSON = function () {
    const o = this.get({ plain: true });
    o._id = o.id;
    if (o.last_message_id) o.lastMessage = o.last_message_id;
    if (o.last_message_at) o.lastMessageAt = o.last_message_at;
    if (o.requested_by_id) o.requestedBy = o.requested_by_id;
    return o;
  };
  return Conversation;
}
