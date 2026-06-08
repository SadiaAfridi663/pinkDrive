const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const ServiceArea = sequelize.define('ServiceArea', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  coordinates: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: 'Array of [lat, lng] pairs forming the polygon boundary',
  },
  color: {
    type: DataTypes.STRING,
    defaultValue: '#e91e8c',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  timestamps: true,
  tableName: 'service_areas',
});

module.exports = ServiceArea;
