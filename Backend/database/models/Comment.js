import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const Comment = sequelize.define(
    'Comment',
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
      authorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'author_id',
      },
      parentCommentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'parent_comment_id',
      },
      content: {
        type: DataTypes.STRING(280),
        allowNull: false,
      },
      likesCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
        field: 'likes_count',
      },
      repliesCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
        field: 'replies_count',
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_deleted',
      },
    },
    {
      tableName: 'comments',
      underscored: true,
      timestamps: true,
    }
  );
  Comment.prototype.toJSON = function () {
    const o = this.get({ plain: true });
    o._id = o.id;
    return o;
  };
  return Comment;
}
