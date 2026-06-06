const dotenv = require('dotenv');
dotenv.config();

const { sequelize } = require('./config/db.sql');
const User = require('./models/User');
const DriverDocument = require('./models/DriverDocument');
const Ride = require('./models/Ride');
const PendingRegistration = require('./models/PendingRegistration');

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected');

    await sequelize.sync({ force: true });
    console.log('Tables dropped and re-created');

    const users = await User.bulkCreate([
      {
        name: 'Passenger One',
        email: 'passenger@pinkdrive.com',
        password: 'password123',
        role: 'passenger',
        gender: 'female',
        phone: '03001111111',
        isVerified: true,
      },
      {
        name: 'Driver One',
        email: 'driver@pinkdrive.com',
        password: 'password123',
        role: 'driver',
        gender: 'female',
        phone: '03002222222',
        isVerified: true,
        isDriverVerified: true,
      },
      {
        name: 'Admin User',
        email: 'admin@pinkdrive.com',
        password: 'password123',
        role: 'admin',
        gender: 'female',
        phone: '03003333333',
        isVerified: true,
      },
    ], { individualHooks: true });

    console.log(`Seeded ${users.length} users`);
    console.log('  passenger@pinkdrive.com / password123');
    console.log('  driver@pinkdrive.com / password123');
    console.log('  admin@pinkdrive.com / password123');

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
