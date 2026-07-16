const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const Transaction = sequelize.define('Transaction', {
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
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['topup', 'ride_payment', 'ride_earnings', 'refund', 'payout', 'withdrawal', 'commission_charge', 'commission_settlement', 'adjustment']],
    },
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  direction: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['credit', 'debit']],
    },
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referenceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referenceType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  rideId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'rides', key: 'id' },
  },
  tripRequestId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'trip_requests', key: 'id' },
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'completed',
    validate: {
      isIn: [['pending', 'completed', 'failed']],
    },
  },
}, {
  timestamps: true,
  tableName: 'transactions',
});

module.exports = Transaction;
