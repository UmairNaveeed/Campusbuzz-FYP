import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const PostMention = sequelize.define(
    'PostMention',
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
      tableName: 'post_mentions',
      underscored: true,
      timestamps: false,
    }
  );
  return PostMention;
}
