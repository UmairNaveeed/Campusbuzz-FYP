import { DataTypes } from 'sequelize';

export default function (sequelize) {
  const Hashtag = sequelize.define(
    'Hashtag',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },
      postsCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        defaultValue: 0,
        field: 'posts_count',
      },
      lastUsed: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used',
      },
    },
    {
      tableName: 'hashtags',
      underscored: true,
      timestamps: true,
    }
  );
  Hashtag.prototype.toJSON = function () {
    const o = this.get({ plain: true });
    o._id = o.id;
    return o;
  };
  return Hashtag;
}
