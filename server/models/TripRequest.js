const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const TripRequest = sequelize.define('TripRequest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tripId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'shared_trips', key: 'id' },
  },
  passengerId: {
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
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'accepted', 'driver_arriving', 'passenger_boarded', 'in_progress', 'dropped_off', 'completed', 'declined', 'cancelled']],
    },
  },
  declineReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  boardingTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  dropoffTime: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  paymentStatus: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
  },
  stripePaymentIntentId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  stripeSessionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'trip_requests',
});

module.exports = TripRequest;
