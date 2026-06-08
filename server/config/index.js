const connectDB = require('./db');
const { connectSQL } = require('./db.sql');

const connectDatabases = async () => {
  await connectDB();
  require('../models/User');
  require('../models/PendingRegistration');
  require('../models/DriverDocument');
  require('../models/Ride');
  require('../models/ServiceArea');
  require('../models/SOSAlert');
  require('../models/EmergencyContact');
  await connectSQL();
};

module.exports = connectDatabases;
