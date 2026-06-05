const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const { sequelize } = require('../config/db.sql');

const PendingRegistration = sequelize.define('PendingRegistration', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { notEmpty: true },
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: 'passenger',
    allowNull: false,
    validate: {
      isIn: [['passenger', 'driver', 'admin']],
    },
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['female']],
    },
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  verificationCode: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  verificationToken: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'pending_registrations',
});

PendingRegistration.generate = function (data) {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const token = crypto.randomBytes(32).toString('hex');
  return {
    name: data.name,
    email: data.email,
    password: data.password,
    gender: data.gender,
    role: data.role || 'passenger',
    phone: data.phone || null,
    verificationCode: code,
    verificationToken: token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
};

module.exports = PendingRegistration;
