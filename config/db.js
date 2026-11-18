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

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      bufferCommands: false
    });
    isConnected = true;
    console.log(`MongoDB Atlas Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Primary Connection Error: ${error.message}`);
    // If SRV lookup failed or a replica set member hit SSL alert 80, fallback to healthy shard directly
    if (uri.includes('cluster0.sa7a3db.mongodb.net')) {
      try {
        console.log('Switching to healthy Atlas shard fallback...');
        const fallbackUri = uri
          .replace('mongodb+srv://', 'mongodb://')
          .replace('cluster0.sa7a3db.mongodb.net', 'ac-3ftticf-shard-00-00.sa7a3db.mongodb.net:27017')
          + (uri.includes('?') ? '&' : '?') + 'directConnection=true&ssl=true&authSource=admin';
        const conn = await mongoose.connect(fallbackUri, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 6000,
          socketTimeoutMS: 30000,
          bufferCommands: false
        });
        isConnected = true;
        console.log(`MongoDB Atlas Connected via Fallback: ${conn.connection.host}`);
        return;
      } catch (fallbackError) {
        console.error(`Fallback connection error: ${fallbackError.message}`);
      }
    }
    throw error;
  }
};

module.exports = connectDB;
