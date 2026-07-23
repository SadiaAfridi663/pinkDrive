'use strict';

const { DataTypes } = require('sequelize');

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function createTableIfNotExists(queryInterface, Sequelize, tableName, definition, options = {}) {
  if (await tableExists(queryInterface, tableName)) return;
  await queryInterface.createTable(tableName, definition, options);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    // ================================================================
    // 1. USERS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.STRING, defaultValue: 'passenger', allowNull: false },
      gender: { type: Sequelize.STRING, allowNull: false },
      phone: { type: Sequelize.STRING, allowNull: true },
      profilePhoto: { type: Sequelize.STRING, allowNull: true },
      isVerified: { type: Sequelize.BOOLEAN, defaultValue: false },
      isSuspended: { type: Sequelize.BOOLEAN, defaultValue: false },
      outstandingDebt: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      warningCount: { type: Sequelize.INTEGER, defaultValue: 0 },
      restriction: { type: Sequelize.STRING, defaultValue: 'none' },
      isDriverVerified: { type: Sequelize.BOOLEAN, defaultValue: false },
      verificationToken: { type: Sequelize.STRING, allowNull: true },
      verificationCode: { type: Sequelize.STRING, allowNull: true },
      verificationTokenExpires: { type: Sequelize.DATE, allowNull: true },
      currentLat: { type: Sequelize.FLOAT, allowNull: true },
      currentLng: { type: Sequelize.FLOAT, allowNull: true },
      lastActiveAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 2. PENDING REGISTRATIONS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'pending_registrations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.STRING, defaultValue: 'passenger', allowNull: false },
      gender: { type: Sequelize.STRING, allowNull: false },
      phone: { type: Sequelize.STRING, allowNull: true },
      emailVerified: { type: Sequelize.BOOLEAN, defaultValue: false, allowNull: false },
      verificationCode: { type: Sequelize.STRING, allowNull: false },
      verificationToken: { type: Sequelize.STRING, allowNull: false },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 3. SERVICE AREAS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'service_areas', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      coordinates: { type: Sequelize.JSON, allowNull: false },
      color: { type: Sequelize.STRING, defaultValue: '#e91e8c' },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 4. RIDES
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'rides', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      passengerId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      driverId: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      pickupLat: { type: Sequelize.FLOAT, allowNull: false },
      pickupLng: { type: Sequelize.FLOAT, allowNull: false },
      pickupAddress: { type: Sequelize.TEXT, allowNull: true },
      dropoffLat: { type: Sequelize.FLOAT, allowNull: false },
      dropoffLng: { type: Sequelize.FLOAT, allowNull: false },
      dropoffAddress: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, defaultValue: 'pending', allowNull: false },
      selfiePath: { type: Sequelize.STRING, allowNull: true },
      passengerOffer: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      fare: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      platformFee: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      driverEarning: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      paymentMethod: { type: Sequelize.STRING, defaultValue: 'cash', allowNull: false },
      paymentStatus: { type: Sequelize.STRING, defaultValue: 'pending', allowNull: false },
      distance: { type: Sequelize.FLOAT, allowNull: true },
      driverLat: { type: Sequelize.FLOAT, allowNull: true },
      driverLng: { type: Sequelize.FLOAT, allowNull: true },
      passengerLat: { type: Sequelize.FLOAT, allowNull: true },
      passengerLng: { type: Sequelize.FLOAT, allowNull: true },
      startedAt: { type: Sequelize.DATE, allowNull: true },
      completedAt: { type: Sequelize.DATE, allowNull: true },
      cancelledAt: { type: Sequelize.DATE, allowNull: true },
      stripeSessionId: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 5. SHARED TRIPS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'shared_trips', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      driverId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      pickupLat: { type: Sequelize.FLOAT, allowNull: false },
      pickupLng: { type: Sequelize.FLOAT, allowNull: false },
      pickupAddress: { type: Sequelize.TEXT, allowNull: true },
      dropoffLat: { type: Sequelize.FLOAT, allowNull: false },
      dropoffLng: { type: Sequelize.FLOAT, allowNull: false },
      dropoffAddress: { type: Sequelize.TEXT, allowNull: true },
      departureTime: { type: Sequelize.DATE, allowNull: false },
      availableSeats: { type: Sequelize.INTEGER, allowNull: false },
      pricePerSeat: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      paymentMethod: { type: Sequelize.STRING, defaultValue: 'cash' },
      status: { type: Sequelize.STRING, defaultValue: 'active' },
      startedAt: { type: Sequelize.DATE, allowNull: true },
      completedAt: { type: Sequelize.DATE, allowNull: true },
      driverLat: { type: Sequelize.FLOAT, allowNull: true },
      driverLng: { type: Sequelize.FLOAT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 6. TRIP REQUESTS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'trip_requests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      tripId: { type: Sequelize.UUID, allowNull: false, references: { model: 'shared_trips', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      passengerId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      pickupLat: { type: Sequelize.FLOAT, allowNull: false },
      pickupLng: { type: Sequelize.FLOAT, allowNull: false },
      pickupAddress: { type: Sequelize.TEXT, allowNull: true },
      dropoffLat: { type: Sequelize.FLOAT, allowNull: false },
      dropoffLng: { type: Sequelize.FLOAT, allowNull: false },
      dropoffAddress: { type: Sequelize.TEXT, allowNull: true },
      requestedSeats: { type: Sequelize.INTEGER, defaultValue: 1 },
      status: { type: Sequelize.STRING, defaultValue: 'pending' },
      declineReason: { type: Sequelize.TEXT, allowNull: true },
      boardingTime: { type: Sequelize.DATE, allowNull: true },
      dropoffTime: { type: Sequelize.DATE, allowNull: true },
      isPaid: { type: Sequelize.BOOLEAN, defaultValue: false },
      paymentStatus: { type: Sequelize.STRING, defaultValue: 'pending' },
      stripePaymentIntentId: { type: Sequelize.STRING, allowNull: true },
      stripeSessionId: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 7. BIDS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'bids', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      rideId: { type: Sequelize.UUID, allowNull: false, references: { model: 'rides', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      driverId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'active' },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 8. DEBTS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'debts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      passengerId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      rideId: { type: Sequelize.UUID, allowNull: false, references: { model: 'rides', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      reason: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'pending', allowNull: false },
      clearedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 9. DISPUTES
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'disputes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      rideId: { type: Sequelize.UUID, allowNull: false, references: { model: 'rides', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      reportedBy: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      disputeType: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, defaultValue: 'open', allowNull: false },
      resolution: { type: Sequelize.TEXT, allowNull: true },
      adminNote: { type: Sequelize.TEXT, allowNull: true },
      resolvedBy: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      resolvedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 10. DRIVER DOCUMENTS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'driver_documents', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      documentType: { type: Sequelize.STRING, allowNull: false },
      filePath: { type: Sequelize.STRING, allowNull: false },
      originalName: { type: Sequelize.STRING, allowNull: false },
      mimeType: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'pending', allowNull: false },
      adminNote: { type: Sequelize.TEXT, allowNull: true },
      reviewedBy: { type: Sequelize.UUID, allowNull: true },
      reviewedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 11. EMERGENCY CONTACTS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'emergency_contacts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      name: { type: Sequelize.STRING, allowNull: false },
      phone: { type: Sequelize.STRING, allowNull: false },
      relationship: { type: Sequelize.STRING, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 12. NOTIFICATIONS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'notifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      type: { type: Sequelize.STRING, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.TEXT, allowNull: true },
      data: { type: Sequelize.JSONB, allowNull: true },
      isRead: { type: Sequelize.BOOLEAN, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 13. REVIEWS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'reviews', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      rideId: { type: Sequelize.UUID, allowNull: true, references: { model: 'rides', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      tripRequestId: { type: Sequelize.UUID, allowNull: true, references: { model: 'trip_requests', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      reviewerId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      reviewedId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      rating: { type: Sequelize.INTEGER, allowNull: false },
      comment: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 14. SOS ALERTS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'sos_alerts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      rideId: { type: Sequelize.UUID, allowNull: true, references: { model: 'rides', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      lat: { type: Sequelize.FLOAT, allowNull: true },
      lng: { type: Sequelize.FLOAT, allowNull: true },
      status: { type: Sequelize.STRING, defaultValue: 'active', allowNull: false },
      resolvedBy: { type: Sequelize.UUID, allowNull: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      resolvedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 15. TRANSACTIONS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'transactions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      type: { type: Sequelize.STRING, allowNull: false },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      direction: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.STRING, allowNull: true },
      referenceId: { type: Sequelize.STRING, allowNull: true },
      referenceType: { type: Sequelize.STRING, allowNull: true },
      rideId: { type: Sequelize.UUID, allowNull: true, references: { model: 'rides', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      tripRequestId: { type: Sequelize.UUID, allowNull: true, references: { model: 'trip_requests', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      status: { type: Sequelize.STRING, defaultValue: 'completed' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 16. WALLETS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'wallets', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, unique: true, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      balance: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      commissionDue: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      totalEarnings: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      totalWithdrawn: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // 17. WITHDRAWAL REQUESTS
    // ================================================================
    await createTableIfNotExists(queryInterface, Sequelize, 'withdrawal_requests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      method: { type: Sequelize.STRING, allowNull: false },
      accountDetails: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'pending' },
      adminNote: { type: Sequelize.STRING, allowNull: true },
      processedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // ================================================================
    // INDEXES (model-defined)
    // ================================================================
    // SharedTrip indexes
    try { await queryInterface.addIndex('shared_trips', ['driverId']); } catch {}
    try { await queryInterface.addIndex('shared_trips', ['status']); } catch {}
    try { await queryInterface.addIndex('shared_trips', ['departureTime']); } catch {}

    // TripRequest indexes
    try { await queryInterface.addIndex('trip_requests', ['tripId']); } catch {}
    try { await queryInterface.addIndex('trip_requests', ['passengerId']); } catch {}
    try { await queryInterface.addIndex('trip_requests', ['status']); } catch {}
    try { await queryInterface.addIndex('trip_requests', ['passengerId', 'status']); } catch {}
  },

  async down(queryInterface, Sequelize) {
    const tables = [
      'withdrawal_requests',
      'transactions',
      'reviews',
      'sos_alerts',
      'notifications',
      'emergency_contacts',
      'driver_documents',
      'disputes',
      'debts',
      'bids',
      'trip_requests',
      'shared_trips',
      'rides',
      'service_areas',
      'pending_registrations',
      'wallets',
      'users',
    ];
    for (const table of tables) {
      if (await tableExists(queryInterface, table)) {
        await queryInterface.dropTable(table);
      }
    }
  },
};
