const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db.sql');

const Review = sequelize.define('Review', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
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
  reviewerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  reviewedId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'reviews',
});

module.exports = Review;
