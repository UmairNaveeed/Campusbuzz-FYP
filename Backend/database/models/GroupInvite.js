import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const GroupInvite = sequelize.define(
    'GroupInvite',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      groupId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'group_id',
      },
      invitedUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'invited_user_id',
      },
      invitedById: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'invited_by_id',
      },
      status: {
        type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      respondedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'responded_at',
      },
    },
    {
      tableName: 'group_invites',
      underscored: true,
      timestamps: true,
    }
  );
  return GroupInvite;
}
