const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');
const logger = require('../utils/logger');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development'
      ? (msg) => logger.debug(msg)
      : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
);

const runMigrations = async () => {
  const umzug = new Umzug({
    migrations: {
      glob: path.join(__dirname, '..', 'migrations', '*.js'),
      resolve: ({ name, path: migrationPath }) => {
        const migration = require(migrationPath);
        return {
          name,
          up: async (ctx) => migration.up(ctx.queryInterface, ctx.Sequelize),
          down: async (ctx) => migration.down(ctx.queryInterface, ctx.Sequelize),
        };
      },
    },
    context: { queryInterface: sequelize.getQueryInterface(), Sequelize },
    storage: new SequelizeStorage({ sequelize }),
    logger: {
      info: (msg) => logger.info(msg),
      warn: (msg) => logger.warn(msg),
      error: (msg) => logger.error(msg),
      debug: (msg) => logger.debug(msg),
    },
  });

  const pending = await umzug.pending();
  if (pending.length > 0) {
    logger.info(`Running ${pending.length} pending migration(s)...`);
    await umzug.up();
    logger.info('Migrations completed');
  } else {
    logger.info('No pending migrations');
  }
};

const connectSQL = async () => {
  try {
    await sequelize.authenticate();
    logger.info('PostgreSQL connected');
    if (process.env.NODE_ENV === 'development') {
      await runMigrations();
    }
  } catch (error) {
    logger.error(`PostgreSQL connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { sequelize, connectSQL };
