'use strict';

const { DataTypes } = require('sequelize');

async function columnExists(queryInterface, table, column) {
  const tableInfo = await queryInterface.describeTable(table);
  return column in tableInfo;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // ================================================================
    // 1. SharedTrip — add driver location fields
    // ================================================================
    if (!(await columnExists(queryInterface, 'shared_trips', 'driverLat'))) {
      await queryInterface.addColumn('shared_trips', 'driverLat', {
        type: Sequelize.FLOAT,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'shared_trips', 'driverLng'))) {
      await queryInterface.addColumn('shared_trips', 'driverLng', {
        type: Sequelize.FLOAT,
        allowNull: true,
      });
    }

    // ================================================================
    // 2. TripRequest — add lifecycle fields + expanded status
    // ================================================================
    if (!(await columnExists(queryInterface, 'trip_requests', 'boardingTime'))) {
      await queryInterface.addColumn('trip_requests', 'boardingTime', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'trip_requests', 'dropoffTime'))) {
      await queryInterface.addColumn('trip_requests', 'dropoffTime', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'trip_requests', 'isPaid'))) {
      await queryInterface.addColumn('trip_requests', 'isPaid', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
    }
    if (!(await columnExists(queryInterface, 'trip_requests', 'paymentStatus'))) {
      await queryInterface.addColumn('trip_requests', 'paymentStatus', {
        type: Sequelize.STRING,
        defaultValue: 'pending',
      });
    }
    if (!(await columnExists(queryInterface, 'trip_requests', 'stripePaymentIntentId'))) {
      await queryInterface.addColumn('trip_requests', 'stripePaymentIntentId', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!(await columnExists(queryInterface, 'trip_requests', 'stripeSessionId'))) {
      await queryInterface.addColumn('trip_requests', 'stripeSessionId', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // ================================================================
    // 3. Transaction — add tripRequestId FK
    // ================================================================
    if (!(await columnExists(queryInterface, 'transactions', 'tripRequestId'))) {
      await queryInterface.addColumn('transactions', 'tripRequestId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'trip_requests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    // ================================================================
    // 4. Indexes for performance
    // ================================================================
    try {
      await queryInterface.addIndex('trip_requests', ['tripId', 'status']);
    } catch { /* index may already exist */ }
    try {
      await queryInterface.addIndex('shared_trips', ['driverId', 'status']);
    } catch { /* index may already exist */ }
    try {
      await queryInterface.addIndex('shared_trips', ['status', 'departureTime']);
    } catch { /* index may already exist */ }
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes (if they exist)
    try { await queryInterface.removeIndex('shared_trips', ['status', 'departureTime']); } catch {}
    try { await queryInterface.removeIndex('shared_trips', ['driverId', 'status']); } catch {}
    try { await queryInterface.removeIndex('trip_requests', ['tripId', 'status']); } catch {}

    // Remove columns (if they exist)
    if (await columnExists(queryInterface, 'transactions', 'tripRequestId')) {
      await queryInterface.removeColumn('transactions', 'tripRequestId');
    }
    for (const col of ['stripeSessionId', 'stripePaymentIntentId', 'paymentStatus', 'isPaid', 'dropoffTime', 'boardingTime']) {
      if (await columnExists(queryInterface, 'trip_requests', col)) {
        await queryInterface.removeColumn('trip_requests', col);
      }
    }
    for (const col of ['driverLng', 'driverLat']) {
      if (await columnExists(queryInterface, 'shared_trips', col)) {
        await queryInterface.removeColumn('shared_trips', col);
      }
    }
  },
};
