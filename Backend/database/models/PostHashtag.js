import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const PostHashtag = sequelize.define(
    'PostHashtag',
    {
      postId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'post_id',
      },
      hashtagId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'hashtag_id',
      },
    },
    {
      tableName: 'post_hashtags',
      underscored: true,
      timestamps: false,
    }
  );
  return PostHashtag;
}
