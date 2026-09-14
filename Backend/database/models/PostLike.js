import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const PostLike = sequelize.define(
    'PostLike',
    {
      postId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'post_id',
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'user_id',
      },
    },
    {
      tableName: 'post_likes',
      underscored: true,
      timestamps: false,
    }
  );
  return PostLike;
}
