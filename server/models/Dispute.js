const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const Dispute = sequelize.define('Dispute', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  rideId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'rides', key: 'id' },
  },
  reportedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  disputeType: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['passenger_refused_payment', 'partial_payment', 'driver_extra_fare', 'driver_false_claim', 'passenger_false_claim', 'digital_payment_failure']],
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'open',
    allowNull: false,
    validate: {
      isIn: [['open', 'under_review', 'resolved_rejected', 'resolved_approved', 'escalated']],
    },
  },
  resolution: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  adminNote: {
    type: DataTypes.TEXT,
    allowNull: true,
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
  tableName: 'disputes',
});

module.exports = Dispute;
