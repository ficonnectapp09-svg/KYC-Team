import mongoose from 'mongoose';
import dns from 'dns';

// Fix for Windows / ISP DNS SRV resolution on mongodb+srv://
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {}

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/connect_db';
    const dbName = process.env.DB_NAME || 'connect_db';

    mongoose.set('strictQuery', false);

    console.log(`[Database]: Connecting to MongoDB (${dbName})...`);
    await mongoose.connect(mongoUri, {
      dbName,
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      family: 4
    });

    console.log(`[Database]: Successfully connected to MongoDB database: ${mongoose.connection.name}`);
  } catch (error: any) {
    console.error(`[Database]: MongoDB Connection Failed - ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[Database]: MongoDB disconnected! Trying to reconnect...');
});

mongoose.connection.on('error', (err) => {
  console.error('[Database]: MongoDB runtime error:', err);
});
