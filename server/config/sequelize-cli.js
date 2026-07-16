require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

module.exports = {
  development: {
    username: process.env.DB_USER || 'pinkdrive_user',
    password: process.env.DB_PASSWORD || 'pinkdrive_pass',
    database: process.env.DB_NAME || 'pinkdrive',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: false,
  },
  test: {
    username: process.env.DB_USER || 'pinkdrive_user',
    password: process.env.DB_PASSWORD || 'pinkdrive_pass',
    database: process.env.DB_NAME || 'pinkdrive_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
  },
};
