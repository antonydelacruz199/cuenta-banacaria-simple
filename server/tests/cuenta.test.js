import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB, disconnectDB, areTransactionsSupported } from '../src/config/database.js';
import Cuenta from '../src/models/Cuenta.js';
import Movimiento from '../src/models/Movimiento.js';
import { CURRENCY, HTTP_STATUS, ERROR_MESSAGES, MOVEMENT_TYPES } from '../src/config/constants.js';
import { describe, test, beforeAll, afterAll, beforeEach, expect } from '@jest/globals';

const formatearMoneda = (centimos) => {
  const valor = centimos / Math.pow(10, CURRENCY.DECIMALS);
  return `${CURRENCY.SYMBOL} ${valor.toLocaleString('es-PE', {
    minimumFractionDigits: CURRENCY.DECIMALS,
    maximumFractionDigits: CURRENCY.DECIMALS,
  })}`;
};

describe('API Cuenta Bancaria', () => {
  let cuenta1, cuenta2, cuenta3;
  let transactionsSupported;

  beforeAll(async () => {
    await connectDB();
    transactionsSupported = await areTransactionsSupported();
    
    if (!transactionsSupported) {
      console.warn('\n⚠ TESTS: Replica set no configurado - Tests de transferencia atómica serán omitidos');
    }
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    // Limpiar colecciones
    await Cuenta.deleteMany({});
    await Movimiento.deleteMany({});
    
    // Crear cuentas de prueba
    cuenta1 = await Cuenta.create({
      numeroCuenta: 'PE0010000001',
      titular: 'María González López',
      saldo: 500000, // S/ 5,000.00
      moneda: CURRENCY.CODE,
      activa: true,
    });
    
    cuenta2 = await Cuenta.create({
      numeroCuenta: 'PE0010000002',
      titular: 'Carlos Rodríguez Pérez',
      saldo: 1250000, // S/ 12,500.00
      moneda: CURRENCY.CODE,
      activa: true,
    });
    
    cuenta3 = await Cuenta.create({
      numeroCuenta: 'PE0010000003',
      titular: 'Ana Martínez Silva',
      saldo: 75000, // S/ 750.00
      moneda: CURRENCY.CODE,
      activa: true,
    });
  });

  describe('GET /api/cuenta/:id - Consulta de cuenta', () => {
    test('Debe retornar cuenta existente con saldo correcto', async () => {
      const response = await request(app)
        .get(`/api/cuenta/${cuenta1._id}`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: cuenta1._id.toString(),
        numeroCuenta: 'PE0010000001',
        titular: 'María González López',
        saldo: 500000,
        moneda: 'PEN',
        activa: true,
      });
      expect(response.body.data.saldoFormateado).toBe('S/ 5,000.00');
      expect(response.body.mensaje).toBe('Cuenta encontrada');
    });

    test('Debe retornar cuenta existente usando número de cuenta', async () => {
      const response = await request(app)
        .get('/api/cuenta/PE0010000001')
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.numeroCuenta).toBe('PE0010000001');
    });

    test('Debe retornar 404 para cuenta inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/cuenta/${fakeId}`)
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
      expect(response.body.code).toBe('ACCOUNT_NOT_FOUND');
    });

    test('Debe retornar 400 para ID inválido', async () => {
      const response = await request(app)
        .get('/api/cuenta/invalido')
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
    });
  });

  describe('POST /api/cuenta/deposito - Depósito', () => {
    test('Debe realizar depósito válido y actualizar saldo', async () => {
      const monto = 100000; // S/ 1,000.00
      const response = await request(app)
        .post('/api/cuenta/deposito')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto,
          descripcion: 'Depósito de prueba',
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cuenta.saldo).toBe(600000); // 500000 + 100000
      expect(response.body.data.cuenta.saldoFormateado).toBe('S/ 6,000.00');
      expect(response.body.data.movimiento.tipo).toBe(MOVEMENT_TYPES.DEPOSITO);
      expect(response.body.data.movimiento.monto).toBe(monto);
      expect(response.body.mensaje).toBe('Depósito realizado correctamente');
    });

    test('Debe rechazar depósito con monto cero', async () => {
      const response = await request(app)
        .post('/api/cuenta/deposito')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto: 0,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(ERROR_MESSAGES.VALIDATION_ERROR);
      expect(response.body.details.some(d => d.message.includes('mayor a cero'))).toBe(true);
    });

    test('Debe rechazar depósito con monto negativo', async () => {
      const response = await request(app)
        .post('/api/cuenta/deposito')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto: -10000,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.details.some(d => d.message.includes('mayor a cero'))).toBe(true);
    });

    test('Debe rechazar depósito con monto no finito', async () => {
      const response = await request(app)
        .post('/api/cuenta/deposito')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto: Infinity,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    test('Debe rechazar depósito con monto decimal (no entero en céntimos)', async () => {
      const response = await request(app)
        .post('/api/cuenta/deposito')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto: 10000.5,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    test('Debe rechazar depósito en cuenta inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post('/api/cuenta/deposito')
        .send({
          cuentaId: fakeId.toString(),
          monto: 100000,
        })
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
    });

    test('Debe ser idempotente con misma referencia', async () => {
      const referencia = 'IDEMPOTENT_TEST_001';
      const monto = 50000;
      
      // Primera vez
      await request(app)
        .post('/api/cuenta/deposito')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto,
          referencia,
        })
        .expect(HTTP_STATUS.CREATED);

      // Segunda vez con misma referencia
      const response = await request(app)
        .post('/api/cuenta/deposito')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto,
          referencia,
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.idempotente).toBe(true);
      expect(response.body.mensaje).toBe('Operación ya procesada (idempotente)');
      
      // Verificar que el saldo solo se incrementó una vez
      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(550000); // 500000 + 50000 (solo una vez)
    });
  });

  describe('POST /api/cuenta/retiro - Retiro', () => {
    test('Debe realizar retiro válido y actualizar saldo', async () => {
      const monto = 200000; // S/ 2,000.00
      const response = await request(app)
        .post('/api/cuenta/retiro')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto,
          descripcion: 'Retiro de prueba',
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cuenta.saldo).toBe(300000); // 500000 - 200000
      expect(response.body.data.cuenta.saldoFormateado).toBe('S/ 3,000.00');
      expect(response.body.data.movimiento.tipo).toBe(MOVEMENT_TYPES.RETIRO);
      expect(response.body.data.movimiento.monto).toBe(monto);
      expect(response.body.mensaje).toBe('Retiro realizado correctamente');
    });

    test('Debe rechazar retiro con fondos insuficientes', async () => {
      const monto = 600000; // Más que el saldo de 500000
      const response = await request(app)
        .post('/api/cuenta/retiro')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(ERROR_MESSAGES.INSUFFICIENT_FUNDS);
      expect(response.body.code).toBe('INSUFFICIENT_FUNDS');
      expect(response.body.details.saldoActual).toBe(500000);
      expect(response.body.details.montoSolicitado).toBe(600000);
    });

    test('Debe rechazar retiro con monto cero', async () => {
      const response = await request(app)
        .post('/api/cuenta/retiro')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto: 0,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    test('Debe rechazar retiro con monto negativo', async () => {
      const response = await request(app)
        .post('/api/cuenta/retiro')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto: -10000,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
    });

    test('Debe ser idempotente con misma referencia', async () => {
      const referencia = 'IDEMPOTENT_RET_001';
      const monto = 30000;
      
      await request(app)
        .post('/api/cuenta/retiro')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto,
          referencia,
        })
        .expect(HTTP_STATUS.CREATED);

      const response = await request(app)
        .post('/api/cuenta/retiro')
        .send({
          cuentaId: cuenta1._id.toString(),
          monto,
          referencia,
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.idempotente).toBe(true);
      
      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(470000); // 500000 - 30000 (solo una vez)
    });
  });

  describe('POST /api/cuenta/transferencia - Transferencia', () => {
    test('Debe realizar transferencia válida entre cuentas', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const monto = 300000; // S/ 3,000.00
      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta2._id.toString(),
          cuentaDestinoId: cuenta3._id.toString(),
          monto,
          descripcion: 'Transferencia de prueba',
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cuentaOrigen.saldo).toBe(950000); // 1250000 - 300000
      expect(response.body.data.cuentaDestino.saldo).toBe(375000); // 75000 + 300000
      expect(response.body.data.movimientoEnviado.tipo).toBe(MOVEMENT_TYPES.TRANSFERENCIA_ENVIADA);
      expect(response.body.data.movimientoRecibido.tipo).toBe(MOVEMENT_TYPES.TRANSFERENCIA_RECIBIDA);
      expect(response.body.data.movimientoEnviado.monto).toBe(monto);
      expect(response.body.data.movimientoRecibido.monto).toBe(monto);
      expect(response.body.mensaje).toBe('Transferencia realizada correctamente');
    });

    test('Debe rechazar transferencia a la misma cuenta', async () => {
      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta1._id.toString(),
          cuentaDestinoId: cuenta1._id.toString(),
          monto: 100000,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(ERROR_MESSAGES.SAME_ACCOUNT_TRANSFER);
    });

    test('Debe rechazar transferencia con fondos insuficientes', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const monto = 2000000; // Más que el saldo de cuenta2 (1250000)
      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta2._id.toString(),
          cuentaDestinoId: cuenta3._id.toString(),
          monto,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(ERROR_MESSAGES.INSUFFICIENT_FUNDS);
      expect(response.body.code).toBe('INSUFFICIENT_FUNDS');
    });

    test('Debe rechazar transferencia a cuenta de destino inexistente', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta1._id.toString(),
          cuentaDestinoId: fakeId.toString(),
          monto: 100000,
        })
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('DESTINATION_ACCOUNT_NOT_FOUND');
    });

    test('Debe rechazar transferencia desde cuenta de origen inexistente', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: fakeId.toString(),
          cuentaDestinoId: cuenta2._id.toString(),
          monto: 100000,
        })
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('ORIGIN_ACCOUNT_NOT_FOUND');
    });

    test('Debe ser idempotente con misma referencia', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const referencia = 'IDEMPOTENT_TRF_001';
      const monto = 200000;
      
      await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta2._id.toString(),
          cuentaDestinoId: cuenta3._id.toString(),
          monto,
          referencia,
        })
        .expect(HTTP_STATUS.CREATED);

      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta2._id.toString(),
          cuentaDestinoId: cuenta3._id.toString(),
          monto,
          referencia,
        })
        .expect(HTTP_STATUS.OK);

      expect(response.body.idempotente).toBe(true);
      
      // Verificar saldos solo cambiaron una vez
      const [origen, destino] = await Promise.all([
        Cuenta.findById(cuenta2._id),
        Cuenta.findById(cuenta3._id),
      ]);
      expect(origen.saldo).toBe(1050000); // 1250000 - 200000
      expect(destino.saldo).toBe(275000); // 75000 + 200000
    });

    test('Debe mantener atomicidad: si falla, ningún saldo cambia', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      // Intentar transferencia que fallará por fondos insuficientes
      const monto = 2000000; // Más que saldo de cuenta2
      
      await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta2._id.toString(),
          cuentaDestinoId: cuenta3._id.toString(),
          monto,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      // Verificar que los saldos NO cambiaron
      const [origen, destino] = await Promise.all([
        Cuenta.findById(cuenta2._id),
        Cuenta.findById(cuenta3._id),
      ]);
      expect(origen.saldo).toBe(1250000); // Sin cambios
      expect(destino.saldo).toBe(75000); // Sin cambios
      
      // Verificar que no se crearon movimientos
      const movimientos = await Movimiento.find({
        $or: [
          { cuentaOrigen: cuenta2._id },
          { cuentaDestino: cuenta3._id },
        ],
      });
      expect(movimientos.length).toBe(0);
    });
  });

  describe('GET /api/cuenta/:id/historial - Historial', () => {
    beforeEach(async () => {
      // Crear algunos movimientos para test
      await Movimiento.create([
        {
          tipo: MOVEMENT_TYPES.DEPOSITO,
          monto: 500000,
          cuentaDestino: cuenta1._id,
          descripcion: 'Depósito inicial',
          referencia: 'HIST_DEP_001',
          saldoAnteriorDestino: 0,
          saldoPosteriorDestino: 500000,
        },
        {
          tipo: MOVEMENT_TYPES.RETIRO,
          monto: 50000,
          cuentaOrigen: cuenta1._id,
          descripcion: 'Retiro en cajero',
          referencia: 'HIST_RET_001',
          saldoAnteriorOrigen: 500000,
          saldoPosteriorOrigen: 450000,
        },
        {
          tipo: MOVEMENT_TYPES.TRANSFERENCIA_ENVIADA,
          monto: 100000,
          cuentaOrigen: cuenta1._id,
          cuentaDestino: cuenta2._id,
          descripcion: 'Transferencia a Carlos',
          referencia: 'HIST_TRF_001_OUT',
          saldoAnteriorOrigen: 450000,
          saldoPosteriorOrigen: 350000,
          saldoAnteriorDestino: 1250000,
          saldoPosteriorDestino: 1350000,
        },
        {
          tipo: MOVEMENT_TYPES.TRANSFERENCIA_RECIBIDA,
          monto: 50000,
          cuentaOrigen: cuenta3._id,
          cuentaDestino: cuenta1._id,
          descripcion: 'Transferencia de Ana',
          referencia: 'HIST_TRF_002_IN',
          saldoAnteriorOrigen: 75000,
          saldoPosteriorOrigen: 25000,
          saldoAnteriorDestino: 350000,
          saldoPosteriorDestino: 400000,
        },
      ]);
    });

    test('Debe retornar historial paginado ordenado por fecha descendente', async () => {
      const response = await request(app)
        .get(`/api/cuenta/${cuenta1._id}/historial`)
        .query({ pagina: 1, limite: 10 })
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.movimientos).toHaveLength(4);
      expect(response.body.data.paginacion.total).toBe(4);
      
      // Verificar orden descendente (más reciente primero)
      const fechas = response.body.data.movimientos.map(m => new Date(m.fecha).getTime());
      for (let i = 1; i < fechas.length; i++) {
        expect(fechas[i-1]).toBeGreaterThanOrEqual(fechas[i]);
      }
    });

    test('Debe distinguir tipos de movimiento correctamente', async () => {
      const response = await request(app)
        .get(`/api/cuenta/${cuenta1._id}/historial`)
        .expect(HTTP_STATUS.OK);

      const tipos = response.body.data.movimientos.map(m => m.tipo);
      expect(tipos).toContain(MOVEMENT_TYPES.DEPOSITO);
      expect(tipos).toContain(MOVEMENT_TYPES.RETIRO);
      expect(tipos).toContain(MOVEMENT_TYPES.TRANSFERENCIA_ENVIADA);
      expect(tipos).toContain(MOVEMENT_TYPES.TRANSFERENCIA_RECIBIDA);
    });

    test('Debe mostrar cuentas involucradas en transferencias', async () => {
      const response = await request(app)
        .get(`/api/cuenta/${cuenta1._id}/historial`)
        .expect(HTTP_STATUS.OK);

      const transferenciaEnviada = response.body.data.movimientos.find(
        m => m.tipo === MOVEMENT_TYPES.TRANSFERENCIA_ENVIADA
      );
      expect(transferenciaEnviada.cuentaDestino).toBeDefined();
      expect(transferenciaEnviada.cuentaDestino.numeroCuenta).toBe('PE0010000002');

      const transferenciaRecibida = response.body.data.movimientos.find(
        m => m.tipo === MOVEMENT_TYPES.TRANSFERENCIA_RECIBIDA
      );
      expect(transferenciaRecibida.cuentaOrigen).toBeDefined();
      expect(transferenciaRecibida.cuentaOrigen.numeroCuenta).toBe('PE0010000003');
    });

    test('Debe manejar paginación correctamente', async () => {
      const response = await request(app)
        .get(`/api/cuenta/${cuenta1._id}/historial`)
        .query({ pagina: 1, limite: 2 })
        .expect(HTTP_STATUS.OK);

      expect(response.body.data.movimientos).toHaveLength(2);
      expect(response.body.data.paginacion.pagina).toBe(1);
      expect(response.body.data.paginacion.limite).toBe(2);
      expect(response.body.data.paginacion.total).toBe(4);
      expect(response.body.data.paginacion.totalPaginas).toBe(2);
      expect(response.body.data.paginacion.hayMas).toBe(true);
    });

    test('Debe retornar historial vacío para cuenta sin movimientos', async () => {
      const cuentaNueva = await Cuenta.create({
        numeroCuenta: 'PE0010000099',
        titular: 'Cuenta Nueva',
        saldo: 0,
        moneda: CURRENCY.CODE,
        activa: true,
      });

      const response = await request(app)
        .get(`/api/cuenta/${cuentaNueva._id}/historial`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.movimientos).toHaveLength(0);
      expect(response.body.data.paginacion.total).toBe(0);
    });

    test('Debe retornar 404 para cuenta inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/cuenta/${fakeId}/historial`)
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
    });
  });

  describe('Consistencia de saldos', () => {
    test('La suma de saldos debe mantenerse constante tras transferencias', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      // Calcular total inicial
      const cuentasIniciales = await Cuenta.find({ activa: true });
      const totalInicial = cuentasIniciales.reduce((sum, c) => sum + c.saldo, 0);

      // Realizar varias transferencias
      await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta2._id.toString(),
          cuentaDestinoId: cuenta1._id.toString(),
          monto: 100000,
        });

      await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta1._id.toString(),
          cuentaDestinoId: cuenta3._id.toString(),
          monto: 50000,
        });

      await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta3._id.toString(),
          cuentaDestinoId: cuenta2._id.toString(),
          monto: 25000,
        });

      // Calcular total final
      const cuentasFinales = await Cuenta.find({ activa: true });
      const totalFinal = cuentasFinales.reduce((sum, c) => sum + c.saldo, 0);

      expect(totalFinal).toBe(totalInicial);
    });
  });
});