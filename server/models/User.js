const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sequelize } = require('../config/db.sql');

const User = sequelize.define('User', {
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
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isDriverVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  verificationToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  verificationCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  verificationTokenExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'users',
  hooks: {
    beforeSave: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
  },
});

User.prototype.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.generateVerificationToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  const code = String(Math.floor(1000 + Math.random() * 9000));
  this.verificationToken = token;
  this.verificationCode = code;
  this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { token, code };
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  delete values.verificationToken;
  delete values.verificationCode;
  delete values.verificationTokenExpires;
  return values;
};

module.exports = User;
