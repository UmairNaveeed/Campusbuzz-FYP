import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const UserCommentedPost = sequelize.define(
    'UserCommentedPost',
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
      postId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'post_id',
      },
      commentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'comment_id',
      },
      postContent: {
        type: DataTypes.STRING(280),
        allowNull: false,
        field: 'post_content',
      },
      commentContent: {
        type: DataTypes.STRING(280),
        allowNull: false,
        field: 'comment_content',
      },
      postAuthorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'post_author_id',
      },
      postAuthorName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'post_author_name',
      },
      postAuthorUsername: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'post_author_username',
      },
      commentedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'commented_at',
      },
    },
    {
      tableName: 'user_commented_posts',
      underscored: true,
      timestamps: false,
    }
  );
  return UserCommentedPost;
}
