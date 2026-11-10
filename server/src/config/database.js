import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cuenta_bancaria?replicaSet=rs0';
const DB_NAME = process.env.MONGODB_DB_NAME || 'cuenta_bancaria';

let isConnected = false;

export const connectDB = async () => {
  if (isConnected) {
    console.log('✓ MongoDB ya está conectado');
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(MONGODB_URI, {
      dbName: DB_NAME,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log(`✓ MongoDB conectado: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Verificar si es replica set (necesario para transacciones)
    const admin = mongoose.connection.db.admin();
    const replStatus = await admin.replSetGetStatus().catch(() => null);
    
    if (replStatus) {
      console.log('✓ Replica set detectado - Transacciones habilitadas');
    } else {
      console.warn('⚠ No se detectó replica set - Las transacciones fallarán');
      console.warn('  Para habilitar transacciones, inicia MongoDB con: mongod --replSet rs0');
      console.warn('  Luego ejecuta en mongosh: rs.initiate()');
    }

    return conn;
  } catch (error) {
    console.error('✗ Error conectando a MongoDB:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('  Asegúrate de que MongoDB esté ejecutándose en localhost:27017');
    }
    if (error.message.includes('replica set')) {
      console.error('  Configura un replica set para usar transacciones');
    }
    
    throw error;
  }
};

export const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('✓ MongoDB desconectado');
  }
};

export const getConnectionStatus = () => ({
  isConnected,
  readyState: mongoose.connection.readyState,
  host: mongoose.connection.host,
  port: mongoose.connection.port,
  name: mongoose.connection.name,
});

// Helper para verificar si las transacciones están disponibles
export const areTransactionsSupported = async () => {
  try {
    const admin = mongoose.connection.db.admin();
    await admin.replSetGetStatus();
    return true;
  } catch {
    return false;
  }
};