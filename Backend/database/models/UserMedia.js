import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const UserMedia = sequelize.define(
    'UserMedia',
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
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'image_url',
      },
      uploadedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'uploaded_at',
      },
    },
    {
      tableName: 'user_media',
      underscored: true,
      timestamps: false,
    }
  );
  return UserMedia;
}
