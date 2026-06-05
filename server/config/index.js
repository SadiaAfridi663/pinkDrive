const connectDB = require('./db');
const { connectSQL } = require('./db.sql');

const connectDatabases = async () => {
  await connectDB();
  require('../models/User');
  require('../models/PendingRegistration');
  require('../models/DriverDocument');
  require('../models/Ride');
  await connectSQL();
};

module.exports = connectDatabases;
