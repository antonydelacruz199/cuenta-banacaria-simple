// Configuración global para tests
import mongoose from 'mongoose';
import { jest, beforeEach, afterAll } from '@jest/globals';

// Aumentar timeout para operaciones de BD
jest.setTimeout(30000);

// Limpiar base de datos entre tests
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

// Variables globales para tests
global.testAccounts = {};
global.testMovements = {};