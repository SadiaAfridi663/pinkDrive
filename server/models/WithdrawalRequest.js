const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const WithdrawalRequest = sequelize.define('WithdrawalRequest', {
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
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  method: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isIn: [['bank', 'jazzcash', 'easypaisa']] },
  },
  accountDetails: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    validate: { isIn: [['pending', 'approved', 'rejected']] },
  },
  adminNote: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'withdrawal_requests',
});

module.exports = WithdrawalRequest;
