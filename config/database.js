const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'chatnow';

  if (!uri) {
    console.log('MongoDB URI not configured, running without database');
    return;
  }

  try {
    await mongoose.connect(uri, {
      dbName,
      retryWrites: true,
      w: 'majority',
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production'
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected, attempting reconnection...');
    });

    console.log(`MongoDB connected: ${mongoose.connection.host}/${dbName}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
};

const getDB = () => mongoose.connection;

module.exports = { connectDB, getDB };
