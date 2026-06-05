const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const DriverDocument = sequelize.define('DriverDocument', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  documentType: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['license', 'registration', 'profile_photo']],
    },
  },
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['pending', 'approved', 'rejected']],
    },
  },
  adminNote: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reviewedBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'driver_documents',
});

module.exports = DriverDocument;
