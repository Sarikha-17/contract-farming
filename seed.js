import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

dotenv.config();

import User from './models/User.js';
import Contract from './models/Contract.js';
import Payment from './models/Payment.js';
import CropUpdate from './models/CropUpdate.js';
import FieldPhoto from './models/FieldPhoto.js';
import Dispute from './models/Dispute.js';
import Notification from './models/Notification.js';
import AuditLog from './models/AuditLog.js';
import config from './config/index.js';

const seedDatabase = async () => {
  try {
    const mongoUri = config?.mongoUri || process.env.MONGODB_URI || 'mongodb://localhost:27017/contract_farming';
    console.log(`Connecting to MongoDB at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB.');

    console.log('Dropping all existing collections...');
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.drop();
    }
    console.log('Collections dropped successfully.');

    // Ensure uploads directory and sample files exist
    const uploadsDir = path.resolve('uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const sample1Path = path.join(uploadsDir, 'sample1.jpg');
    const sample2Path = path.join(uploadsDir, 'sample2.jpg');
    if (!fs.existsSync(sample1Path)) {
      // 1x1 dummy JPEG bytes
      const dummyJpeg = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
        0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
        0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
        0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
        0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
        0x00, 0xbf, 0x80, 0xff, 0xd9
      ]);
      fs.writeFileSync(sample1Path, dummyJpeg);
      fs.writeFileSync(sample2Path, dummyJpeg);
    }

    console.log('Creating users...');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash('admin123', salt);
    const farmerPasswordHash = await bcrypt.hash('farmer123', salt);
    const merchantPasswordHash = await bcrypt.hash('merchant123', salt);

    const admin = await User.create({
      name: 'Admin',
      phone: '9999999999',
      passwordHash: adminPasswordHash,
      role: 'admin',
      verified: true
    });

    const farmer1 = await User.create({
      name: 'R. Kumar',
      phone: '9876543210',
      passwordHash: farmerPasswordHash,
      role: 'farmer',
      verified: true,
      village: 'Thanjavur'
    });

    const farmer2 = await User.create({
      name: 'S. Lakshmi',
      phone: '9876543211',
      passwordHash: farmerPasswordHash,
      role: 'farmer',
      verified: true,
      village: 'Madurai'
    });

    const merchant = await User.create({
      name: 'AgriMart Foods',
      phone: '9876500000',
      passwordHash: merchantPasswordHash,
      role: 'buyer',
      verified: true,
      company: 'AgriMart Foods Pvt Ltd'
    });

    console.log('Users created successfully.');

    console.log('Creating contracts...');
    const now = new Date();
    const threeMonthsLater = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const fourMonthsLater = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);
    const sixMonthsLater = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    const contract1 = await Contract.create({
      contractId: 'CF-1042',
      farmer: farmer1._id,
      buyer: merchant._id,
      crop: 'Paddy',
      quantityQuintals: 100,
      pricePerQuintal: 2200,
      grade: 'A',
      deliveryDate: threeMonthsLater,
      signedByFarmer: {
        signed: true,
        signedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)
      },
      signedByBuyer: {
        signed: true,
        signedAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)
      },
      status: 'active',
      stage: 1
    });

    const contract2 = await Contract.create({
      contractId: 'CF-1043',
      farmer: farmer2._id,
      buyer: merchant._id,
      crop: 'Groundnut',
      quantityQuintals: 50,
      pricePerQuintal: 5500,
      grade: 'B',
      deliveryDate: fourMonthsLater,
      signedByFarmer: {
        signed: true,
        signedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000)
      },
      signedByBuyer: {
        signed: true,
        signedAt: new Date(now.getTime() - 11 * 24 * 60 * 60 * 1000)
      },
      status: 'active',
      stage: 0
    });

    const contract3 = await Contract.create({
      contractId: 'CF-1044',
      farmer: farmer1._id,
      buyer: merchant._id,
      crop: 'Turmeric',
      quantityQuintals: 30,
      pricePerQuintal: 8000,
      grade: 'A',
      deliveryDate: sixMonthsLater,
      signedByFarmer: {
        signed: false
      },
      signedByBuyer: {
        signed: true,
        signedAt: new Date()
      },
      status: 'awaiting_signature',
      stage: 0
    });

    console.log('Contracts created successfully.');

    console.log('Creating payments...');
    // CF-1042 Payments (Total = 100 * 2200 = 220,000)
    await Payment.create([
      {
        contract: contract1._id,
        milestone: 0,
        percent: 30,
        amount: 66000,
        status: 'paid',
        paidAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
        invoiceNo: 'INV-CF1042-M0'
      },
      {
        contract: contract1._id,
        milestone: 1,
        percent: 40,
        amount: 88000,
        status: 'pending'
      },
      {
        contract: contract1._id,
        milestone: 2,
        percent: 30,
        amount: 66000,
        status: 'pending'
      }
    ]);

    // CF-1043 Payments (Total = 50 * 5500 = 275,000)
    await Payment.create([
      {
        contract: contract2._id,
        milestone: 0,
        percent: 30,
        amount: 82500,
        status: 'pending'
      },
      {
        contract: contract2._id,
        milestone: 1,
        percent: 40,
        amount: 110000,
        status: 'pending'
      },
      {
        contract: contract2._id,
        milestone: 2,
        percent: 30,
        amount: 82500,
        status: 'pending'
      }
    ]);

    // CF-1044 Payments (Total = 30 * 8000 = 240,000)
    await Payment.create([
      {
        contract: contract3._id,
        milestone: 0,
        percent: 30,
        amount: 72000,
        status: 'pending'
      },
      {
        contract: contract3._id,
        milestone: 1,
        percent: 40,
        amount: 96000,
        status: 'pending'
      },
      {
        contract: contract3._id,
        milestone: 2,
        percent: 30,
        amount: 72000,
        status: 'pending'
      }
    ]);
    console.log('Payments created successfully.');

    console.log('Creating CropUpdates...');
    await CropUpdate.create([
      {
        contract: contract1._id,
        stage: 0,
        note: 'Sowing completed with certified high-yield Paddy seeds in Sector A.',
        createdBy: farmer1._id,
        createdAt: new Date(now.getTime() - 19 * 24 * 60 * 60 * 1000)
      },
      {
        contract: contract1._id,
        stage: 1,
        note: 'Germination rate exceeds 95%. First irrigation cycle and bio-fertilizer applied.',
        createdBy: farmer1._id,
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
      }
    ]);
    console.log('CropUpdates created successfully.');

    console.log('Creating FieldPhotos...');
    await FieldPhoto.create([
      {
        contract: contract1._id,
        stage: 0,
        note: 'Field prepared and seeds sown across the northern plot.',
        filePath: 'uploads/sample1.jpg',
        mimeType: 'image/jpeg',
        size: 102400,
        location: { lat: 10.787, lng: 79.1378 },
        uploadedBy: farmer1._id,
        takenAt: new Date(now.getTime() - 19 * 24 * 60 * 60 * 1000),
        seenByBuyer: true,
        createdAt: new Date(now.getTime() - 19 * 24 * 60 * 60 * 1000)
      },
      {
        contract: contract1._id,
        stage: 1,
        note: 'Healthy vegetative growth and seedling stand.',
        filePath: 'uploads/sample2.jpg',
        mimeType: 'image/jpeg',
        size: 204800,
        location: { lat: 10.788, lng: 79.1385 },
        uploadedBy: farmer1._id,
        takenAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        seenByBuyer: false,
        createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
      }
    ]);
    console.log('FieldPhotos created successfully.');

    console.log('Creating Dispute...');
    const dispute = await Dispute.create({
      disputeId: 'DSP-0001',
      contract: contract1._id,
      raisedBy: farmer1._id,
      reason: 'Delivery schedule needs to be extended due to unseasonal rain',
      status: 'open',
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    });
    console.log('Dispute created successfully.');

    console.log('Creating Notifications...');
    await Notification.create([
      {
        user: farmer1._id,
        message: 'Milestone 0 payment of ₹66,000 received for contract CF-1042',
        type: 'payment_released',
        link: `/contracts/${contract1._id}/payments`,
        read: true,
        createdAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000)
      },
      {
        user: merchant._id,
        message: 'New field photo uploaded for contract CF-1042',
        type: 'photo_uploaded',
        link: `/contracts/${contract1._id}/photos`,
        read: false,
        createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
      },
      {
        user: admin._id,
        message: 'New dispute DSP-0001 raised for contract CF-1042',
        type: 'dispute_raised',
        link: `/disputes/${dispute._id}`,
        read: false,
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      }
    ]);
    console.log('Notifications created successfully.');

    console.log('Logging initial audit entries...');
    await AuditLog.create([
      {
        actor: merchant._id,
        action: 'CREATE_CONTRACT',
        entity: 'Contract',
        entityId: contract1._id.toString(),
        meta: { contractId: 'CF-1042', crop: 'Paddy' },
        createdAt: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)
      },
      {
        actor: farmer1._id,
        action: 'SIGN_CONTRACT',
        entity: 'Contract',
        entityId: contract1._id.toString(),
        meta: { contractId: 'CF-1042', party: 'farmer' },
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)
      },
      {
        actor: merchant._id,
        action: 'RELEASE_PAYMENT',
        entity: 'Payment',
        entityId: 'INV-CF1042-M0',
        meta: { milestone: 0, amount: 66000 },
        createdAt: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000)
      }
    ]);

    console.log(`
====================================
  Demo Login Credentials
====================================
Role      | Phone        | Password
----------|--------------|------------
Admin     | 9999999999   | admin123
Farmer    | 9876543210   | farmer123
Farmer    | 9876543211   | farmer123
Merchant  | 9876500000   | merchant123
====================================
`);

    console.log('Seeding completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
};

seedDatabase();
