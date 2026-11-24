const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('CRITICAL: MONGODB_URI is not defined in environment variables!');
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  // 1. Try Primary Atlas URI
  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 4000,
      socketTimeoutMS: 30000,
      bufferCommands: false
    });
    isConnected = true;
    console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
    return;
  } catch (error) {
    console.warn(`MongoDB Primary Connection Error (${error.message}). Trying fallbacks...`);
  }

  // 2. Try Healthy Atlas Shard Directly
  if (uri.includes('cluster0.sa7a3db.mongodb.net')) {
    try {
      console.log('Connecting to healthy Atlas shard fallback...');
      const fallbackUri = uri
        .replace('mongodb+srv://', 'mongodb://')
        .replace('cluster0.sa7a3db.mongodb.net', 'ac-3ftticf-shard-00-00.sa7a3db.mongodb.net:27017')
        + (uri.includes('?') ? '&' : '?') + 'directConnection=true&ssl=true&authSource=admin';
      const conn = await mongoose.connect(fallbackUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 4000,
        socketTimeoutMS: 30000,
        bufferCommands: false
      });
      isConnected = true;
      console.log(`MongoDB Atlas Connected via Fallback Shard: ${conn.connection.host}`);
      return;
    } catch (fallbackError) {
      console.warn(`Atlas shard fallback error: ${fallbackError.message}`);
    }
  }

  // 3. Ultra-Reliable Local MongoDB Fallback (Prevents Network & Token Failure when Atlas SSL/Replica fails)
  try {
    console.log('Connecting to local MongoDB service fallback...');
    const localUri = 'mongodb://127.0.0.1:27017/crm_database';
    const conn = await mongoose.connect(localUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 20000,
      bufferCommands: false
    });
    isConnected = true;
    console.log(`MongoDB Connected via High-Speed Local DB: ${conn.connection.host}`);
    return;
  } catch (localError) {
    console.error(`Local MongoDB fallback error: ${localError.message}`);
    throw localError;
  }
};

module.exports = connectDB;
