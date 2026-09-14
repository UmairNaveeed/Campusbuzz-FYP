import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const Post = sequelize.define(
    'Post',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      authorId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'author_id',
      },
      content: {
        type: DataTypes.STRING(280),
        allowNull: false,
      },
      yalla : {
        type: DataTypes.STRING(280),
        allowNull: true,
      },
      image: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      likesCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
        field: 'likes_count',
      },
      commentsCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
        field: 'comments_count',
      },
      reportsCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
        field: 'reports_count',
      },
      sharesCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
        field: 'shares_count',
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_deleted',
      },
      visibility: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'public',
        field: 'visibility',
      },
      SentimentLabel : {
        type: DataTypes.STRING(280),
        allowNull: true,

      },
      Model : {
        type: DataTypes.STRING(280),
        allowNull: true,

      },
      ModelVersion : {
        type: DataTypes.STRING(280),
        allowNull: true,
      }
    },
    {
      tableName: 'posts',
      underscored: true,
      timestamps: true,
    }
  );
  Post.prototype.toJSON = function () {
    const o = this.get({ plain: true });
    o._id = o.id;
    return o;
  };
  return Post;
}
