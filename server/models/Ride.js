const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const Ride = sequelize.define('Ride', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  passengerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  driverId: {
    type: DataTypes.UUID,
    allowNull: true,
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
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['pending', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled']],
    },
  },
  selfiePath: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  fare: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  paymentMethod: {
    type: DataTypes.STRING,
    defaultValue: 'cash',
    allowNull: false,
    validate: {
      isIn: [['cash', 'stripe', 'card']],
    },
  },
  paymentStatus: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['pending', 'paid', 'failed', 'refunded']],
    },
  },
  distance: {
    type: DataTypes.FLOAT,
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
  passengerLat: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  passengerLng: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  stripeSessionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'rides',
});

module.exports = Ride;
