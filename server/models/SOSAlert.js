const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const SOSAlert = sequelize.define('SOSAlert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  rideId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'rides', key: 'id' },
  },
  lat: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  lng: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
    allowNull: false,
    validate: {
      isIn: [['active', 'resolved']],
    },
  },
  resolvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'sos_alerts',
});

module.exports = SOSAlert;
