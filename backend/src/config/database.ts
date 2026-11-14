import mongoose from 'mongoose';
import dns from 'dns';

// Fix for Windows / ISP DNS SRV resolution on mongodb+srv://
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('[Database Configuration Error]: MONGODB_URI is not defined in backend/.env');
    }

    const dbName = process.env.DB_NAME || 'connect_db';

    mongoose.set('strictQuery', false);

    console.log(`[Database]: Connecting securely to MongoDB (${dbName})...`);
    await mongoose.connect(mongoUri, {
      dbName,
      maxPoolSize: 25,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      family: 4
    });

    console.log(`[Database]: Successfully connected to MongoDB database: ${mongoose.connection.name}`);
  } catch (error: any) {
    console.error(`[Database]: MongoDB Connection Failed - ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('connected', () => {
  console.log('[Database]: MongoDB connection active and ready.');
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database]: MongoDB connection successfully re-established.');
});

mongoose.connection.on('disconnected', () => {
  console.warn('[Database]: MongoDB disconnected! Reconnecting automatically...');
});

mongoose.connection.on('error', (err) => {
  console.error('[Database]: MongoDB runtime error:', err);
});
