import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const Message = sequelize.define(
    'Message',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      conversationId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'conversation_id',
      },
      senderId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'sender_id',
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      mediaType: {
        type: DataTypes.ENUM('image', 'video'),
        allowNull: true,
        field: 'media_type',
      },
      mediaUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'media_url',
      },
      linkUrl: {
        type: DataTypes.STRING(2048),
        allowNull: true,
        field: 'link_url',
      },
      linkTitle: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'link_title',
      },
      linkDescription: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'link_description',
      },
      linkThumbnail: {
        type: DataTypes.STRING(2048),
        allowNull: true,
        field: 'link_thumbnail',
      },
      deliveryStatus: {
        type: DataTypes.ENUM('sent', 'delivered', 'read'),
        defaultValue: 'sent',
        field: 'delivery_status',
      },
      isStarred: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_starred',
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_deleted',
      },
      encrypted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      encryptionKey: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'encryption_key',
      },
    },
    {
      tableName: 'messages',
      underscored: true,
      timestamps: true,
    }
  );
  Message.prototype.toJSON = function () {
    const o = this.get({ plain: true });
    o._id = o.id;
    if (o.sender_id) o.sender = o.sender_id;
    if (o.conversation_id) o.conversation = o.conversation_id;
    if (o.media_type || o.media_url) o.media = o.media_type ? { type: o.media_type, url: o.media_url } : undefined;
    if (o.link_url) o.link = { url: o.link_url, title: o.link_title, description: o.link_description, thumbnail: o.link_thumbnail };
    return o;
  };
  return Message;
}
