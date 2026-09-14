import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const CommentLike = sequelize.define(
    'CommentLike',
    {
      commentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'comment_id',
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'user_id',
      },
    },
    {
      tableName: 'comment_likes',
      underscored: true,
      timestamps: false,
    }
  );
  return CommentLike;
}
