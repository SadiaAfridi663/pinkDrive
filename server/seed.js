const dotenv = require('dotenv');
dotenv.config();

const { sequelize } = require('./config/db.sql');
const User = require('./models/User');
const DriverDocument = require('./models/DriverDocument');
const Ride = require('./models/Ride');
const PendingRegistration = require('./models/PendingRegistration');
const ServiceArea = require('./models/ServiceArea');
const SOSAlert = require('./models/SOSAlert');
const EmergencyContact = require('./models/EmergencyContact');

const UNSPLASH_BASE = 'https://images.unsplash.com/photo';

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected');

    await sequelize.sync({ force: true });
    console.log('Tables dropped and re-created');

    const users = await User.bulkCreate([
      {
        name: 'Ayesha Khan',
        email: 'passenger@pinkdrive.com',
        password: 'password123',
        role: 'passenger',
        gender: 'female',
        phone: '03001111111',
        isVerified: true,
        profilePhoto: `${UNSPLASH_BASE}-1487419919693-7e1a7d30a9ae?w=200&h=200&fit=crop`,
      },
      {
        name: 'Fatima Ali',
        email: 'driver@pinkdrive.com',
        password: 'password123',
        role: 'driver',
        gender: 'female',
        phone: '03002222222',
        isVerified: true,
        isDriverVerified: true,
        profilePhoto: `${UNSPLASH_BASE}-1494792157136-9d2efb0d6c30?w=200&h=200&fit=crop`,
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
      {
        name: 'Zara Mahmood',
        email: 'passenger2@pinkdrive.com',
        password: 'password123',
        role: 'passenger',
        gender: 'female',
        phone: '03004444444',
        isVerified: true,
        profilePhoto: `${UNSPLASH_BASE}-1524502395851-3c3c5f04ed89?w=200&h=200&fit=crop`,
      },
      {
        name: 'Sana Tariq',
        email: 'driver2@pinkdrive.com',
        password: 'password123',
        role: 'driver',
        gender: 'female',
        phone: '03005555555',
        isVerified: true,
        isDriverVerified: false,
        profilePhoto: `${UNSPLASH_BASE}-1534528741775-53994a69daeb?w=200&h=200&fit=crop`,
      },
    ], { individualHooks: true });

    const passenger1 = users[0];
    const driver1 = users[1];
    const admin = users[2];
    const passenger2 = users[3];
    const driver2 = users[4];

    console.log(`Seeded ${users.length} users`);
    console.log('  passenger@pinkdrive.com / password123');
    console.log('  driver@pinkdrive.com / password123');
    console.log('  admin@pinkdrive.com / password123');
    console.log('  passenger2@pinkdrive.com / password123');
    console.log('  driver2@pinkdrive.com / password123');

    // Driver Documents for verified driver
    await DriverDocument.bulkCreate([
      {
        userId: driver1.id,
        documentType: 'license',
        filePath: `${UNSPLASH_BASE}-1589829542664-5a6d1e1af6f2?w=600&h=400&fit=crop`,
        originalName: 'license.jpg',
        mimeType: 'image/jpeg',
        status: 'approved',
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      },
      {
        userId: driver1.id,
        documentType: 'registration',
        filePath: `${UNSPLASH_BASE}-1560472355071-f0c6d7b7b1b8?w=600&h=400&fit=crop`,
        originalName: 'registration.jpg',
        mimeType: 'image/jpeg',
        status: 'approved',
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      },
      {
        userId: driver1.id,
        documentType: 'profile_photo',
        filePath: `${UNSPLASH_BASE}-1494792157136-9d2efb0d6c30?w=600&h=400&fit=crop`,
        originalName: 'profile.jpg',
        mimeType: 'image/jpeg',
        status: 'approved',
        reviewedBy: admin.id,
        reviewedAt: new Date(),
      },
    ]);

    // Driver Documents for unverified driver
    await DriverDocument.bulkCreate([
      {
        userId: driver2.id,
        documentType: 'license',
        filePath: `${UNSPLASH_BASE}-1589829542664-5a6d1e1af6f2?w=600&h=400&fit=crop`,
        originalName: 'license.jpg',
        mimeType: 'image/jpeg',
        status: 'pending',
      },
      {
        userId: driver2.id,
        documentType: 'registration',
        filePath: `${UNSPLASH_BASE}-1560472355071-f0c6d7b7b1b8?w=600&h=400&fit=crop`,
        originalName: 'registration.jpg',
        mimeType: 'image/jpeg',
        status: 'pending',
      },
    ]);

    console.log('Seeded driver documents');

    // Sample completed ride
    await Ride.create({
      passengerId: passenger1.id,
      driverId: driver1.id,
      pickupLat: 31.5204,
      pickupLng: 74.3587,
      pickupAddress: 'Lahore, Pakistan — Liberty Chowk',
      dropoffLat: 31.4828,
      dropoffLng: 74.3520,
      dropoffAddress: 'Lahore, Pakistan — Gulberg',
      status: 'completed',
      fare: 450.00,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      distance: 5.3,
      startedAt: new Date(Date.now() - 7200000),
      completedAt: new Date(Date.now() - 3600000),
    });

    // Another completed ride
    await Ride.create({
      passengerId: passenger2.id,
      driverId: driver1.id,
      pickupLat: 31.5497,
      pickupLng: 74.3436,
      pickupAddress: 'Lahore, Pakistan — Jail Road',
      dropoffLat: 31.4720,
      dropoffLng: 74.4080,
      dropoffAddress: 'Lahore, Pakistan — DHA Phase 1',
      status: 'completed',
      fare: 620.00,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      distance: 8.7,
      startedAt: new Date(Date.now() - 86400000),
      completedAt: new Date(Date.now() - 82800000),
    });

    // A pending ride
    await Ride.create({
      passengerId: passenger1.id,
      pickupLat: 31.5204,
      pickupLng: 74.3587,
      pickupAddress: 'Lahore, Pakistan — Liberty Chowk',
      dropoffLat: 31.4710,
      dropoffLng: 74.4100,
      dropoffAddress: 'Lahore, Pakistan — DHA Phase 2',
      status: 'pending',
      fare: 350.00,
      paymentMethod: 'cash',
      distance: 4.2,
    });

    // A cancelled ride
    await Ride.create({
      passengerId: passenger2.id,
      pickupLat: 31.5110,
      pickupLng: 74.3510,
      pickupAddress: 'Lahore, Pakistan — MM Alam Road',
      dropoffLat: 31.4800,
      dropoffLng: 74.3650,
      dropoffAddress: 'Lahore, Pakistan — Main Market',
      status: 'cancelled',
      fare: 280.00,
      paymentMethod: 'cash',
      distance: 3.1,
      cancelledAt: new Date(Date.now() - 43200000),
    });

    console.log('Seeded rides');

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
};

seed();
