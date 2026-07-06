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
  require('../models/Dispute');
  require('../models/Debt');
  require('../models/Wallet');
  require('../models/Transaction');
  require('../models/WithdrawalRequest');
  require('../models/Bid');
  require('../models/SharedTrip');
  require('../models/TripRequest');
  require('../models/Review');
  require('../models/Notification');
  await connectSQL();
};

module.exports = connectDatabases;
