import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const MessageReport = sequelize.define(
    'MessageReport',
    {
      messageId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'message_id',
      },
      reportId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'report_id',
      },
    },
    {
      tableName: 'message_reports',
      underscored: true,
      timestamps: false,
    }
  );
  return MessageReport;
}
