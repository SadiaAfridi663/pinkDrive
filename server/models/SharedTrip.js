const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const SharedTrip = sequelize.define('SharedTrip', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  driverId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  pickupLat: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  pickupLng: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  pickupAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  dropoffLat: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  dropoffLng: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  dropoffAddress: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  departureTime: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  availableSeats: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 10 },
  },
  pricePerSeat: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  paymentMethod: {
    type: DataTypes.STRING,
    defaultValue: 'cash',
    validate: {
      isIn: [['cash', 'wallet', 'stripe']],
    },
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active',
    validate: {
      isIn: [['active', 'full', 'in_progress', 'completed', 'cancelled', 'archived']],
    },
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  driverLat: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  driverLng: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'shared_trips',
  indexes: [
    { fields: ['driverId'] },
    { fields: ['status'] },
    { fields: ['departureTime'] },
    { fields: ['status', 'departureTime'] },
  ],
});

module.exports = SharedTrip;
