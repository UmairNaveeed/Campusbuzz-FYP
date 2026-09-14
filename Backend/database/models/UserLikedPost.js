import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const UserLikedPost = sequelize.define(
    'UserLikedPost',
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
      postContent: {
        type: DataTypes.STRING(280),
        allowNull: false,
        field: 'post_content',
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
      likedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'liked_at',
      },
    },
    {
      tableName: 'user_liked_posts',
      underscored: true,
      timestamps: false,
    }
  );
  return UserLikedPost;
}
