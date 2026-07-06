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
      isIn: [['pending', 'accepted', 'declined', 'cancelled']],
    },
  },
  declineReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'trip_requests',
});

module.exports = TripRequest;
