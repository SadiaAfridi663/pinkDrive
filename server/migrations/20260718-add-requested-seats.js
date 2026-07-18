'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const { sequelize } = require('../config/db.sql');
    await sequelize.query(
      `ALTER TABLE trip_requests ADD COLUMN IF NOT EXISTS "requestedSeats" INTEGER DEFAULT 1;`
    );
  },

  async down(queryInterface, Sequelize) {
    const { sequelize } = require('../config/db.sql');
    await sequelize.query(
      `ALTER TABLE trip_requests DROP COLUMN IF EXISTS "requestedSeats";`
    );
  },
};
