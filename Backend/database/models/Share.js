import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const Share = sequelize.define(
    'Share',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      postId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'post_id',
      },
      sharedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'shared_by_id',
      },
      sharedWithId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'shared_with_id',
      },
      message: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'viewed', 'accepted'),
        defaultValue: 'pending',
      },
    },
    {
      tableName: 'shares',
      underscored: true,
      timestamps: true,
    }
  );
  Share.prototype.toJSON = function () {
    const o = this.get({ plain: true });
    o._id = o.id;
    if (o.post_id) o.post = o.post_id;
    if (o.shared_by_id) o.sharedBy = o.shared_by_id;
    if (o.shared_with_id) o.sharedWith = o.shared_with_id;
    return o;
  };
  return Share;
}
