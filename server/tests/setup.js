// Configuración global para tests

// Base de datos INDEPENDIENTE para pruebas: nunca se limpia ni altera la base
// de desarrollo. Debe definirse ANTES de que connectDB() lea las variables de
// entorno (dotenv no sobreescribe variables ya presentes en process.env).
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/cuenta_bancaria_test?replicaSet=rs0';
process.env.MONGODB_DB_NAME = process.env.MONGODB_DB_NAME_TEST || 'cuenta_bancaria_test';

import mongoose from 'mongoose';
import { jest, beforeEach, afterAll } from '@jest/globals';

// Aumentar timeout para operaciones de BD
jest.setTimeout(30000);

// Limpiar base de datos de PRUEBAS entre tests
beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

// Cerrar conexión al final
afterAll(async () => {
  await mongoose.disconnect();
});
