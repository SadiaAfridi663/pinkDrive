const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const Debt = sequelize.define('Debt', {
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
  rideId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'rides', key: 'id' },
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['passenger_refused_payment', 'partial_payment', 'other']],
    },
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['pending', 'cleared']],
    },
  },
  clearedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'debts',
});

module.exports = Debt;
