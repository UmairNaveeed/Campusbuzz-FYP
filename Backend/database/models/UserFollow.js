import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const UserFollow = sequelize.define(
    'UserFollow',
    {
      followerId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'follower_id',
      },
      followingId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'following_id',
      },
    },
    {
      tableName: 'user_follows',
      underscored: true,
      timestamps: false,
    }
  );
  return UserFollow;
}
