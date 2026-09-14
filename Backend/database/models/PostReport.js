import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const PostReport = sequelize.define(
    'PostReport',
    {
      postId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'post_id',
      },
      reportId: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        field: 'report_id',
      },
    },
    {
      tableName: 'post_reports',
      underscored: true,
      timestamps: false,
    }
  );
  return PostReport;
}
