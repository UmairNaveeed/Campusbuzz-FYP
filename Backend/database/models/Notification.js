import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const Notification = sequelize.define(
    'Notification',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_id',
      },
      actorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'actor_id',
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'read_at',
      },
      postId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'post_id',
      },
      commentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'comment_id',
      },
      extra: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
    },
    {
      tableName: 'notifications',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );
  Notification.prototype.toJSON = function () {
    const o = this.get({ plain: true });
    o._id = o.id;
    return o;
  };
  return Notification;
}
