import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { connectDB, disconnectDB, areTransactionsSupported } from '../src/config/database.js';
import Cuenta from '../src/models/Cuenta.js';
import Movimiento from '../src/models/Movimiento.js';
import { CURRENCY, HTTP_STATUS, ERROR_MESSAGES, MOVEMENT_TYPES } from '../src/config/constants.js';
import { describe, test, beforeAll, afterAll, beforeEach, expect, jest } from '@jest/globals';

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

  describe('Procesamiento monetario (integración)', () => {
    test('Depósito del monto mínimo (1 céntimo) actualiza el saldo exactamente', async () => {
      const response = await request(app)
        .post('/api/cuenta/deposito')
        .send({ cuentaId: cuenta1._id.toString(), monto: 1 })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.data.cuenta.saldo).toBe(500001);
      expect(response.body.data.movimiento.saldoAnteriorDestino).toBe(500000);
      expect(response.body.data.movimiento.saldoPosteriorDestino).toBe(500001);
    });

    test('Retiro del saldo completo deja el saldo en 0', async () => {
      const response = await request(app)
        .post('/api/cuenta/retiro')
        .send({ cuentaId: cuenta1._id.toString(), monto: 500000 })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.data.cuenta.saldo).toBe(0);
      expect(response.body.data.movimiento.saldoAnteriorOrigen).toBe(500000);
      expect(response.body.data.movimiento.saldoPosteriorOrigen).toBe(0);

      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(0);
    });
  });

  describe('Transferencia - identificadores equivalentes de la misma cuenta', () => {
    test('Rechaza transferencia a la misma cuenta referida por ObjectId y por número de cuenta', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta1._id.toString(),
          cuentaDestinoId: cuenta1.numeroCuenta,
          monto: 100000,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe(ERROR_MESSAGES.SAME_ACCOUNT_TRANSFER);
    });

    test('Rechaza transferencia a la misma cuenta referida por número de cuenta y ObjectId (orden inverso)', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta1.numeroCuenta,
          cuentaDestinoId: cuenta1._id.toString(),
          monto: 100000,
        })
        .expect(HTTP_STATUS.BAD_REQUEST);

      expect(response.body.error).toBe(ERROR_MESSAGES.SAME_ACCOUNT_TRANSFER);
    });

    test('Acepta transferencia usando números de cuenta como identificadores', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({
          cuentaOrigenId: cuenta2.numeroCuenta,
          cuentaDestinoId: cuenta3.numeroCuenta,
          monto: 300000,
        })
        .expect(HTTP_STATUS.CREATED);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cuentaOrigen.numeroCuenta).toBe('PE0010000002');
      expect(response.body.data.cuentaOrigen.saldo).toBe(950000);
      expect(response.body.data.cuentaDestino.numeroCuenta).toBe('PE0010000003');
      expect(response.body.data.cuentaDestino.saldo).toBe(375000);
    });
  });

  describe('Concurrencia', () => {
    test('Dos retiros simultáneos sobre la misma cuenta: solo uno puede consumir el saldo disponible', async () => {
      // Saldo 500000; dos retiros de 300000 en paralelo: exactamente uno debe salir
      const [r1, r2] = await Promise.all([
        request(app).post('/api/cuenta/retiro').send({ cuentaId: cuenta1._id.toString(), monto: 300000 }),
        request(app).post('/api/cuenta/retiro').send({ cuentaId: cuenta1._id.toString(), monto: 300000 }),
      ]);

      const exitosos = [r1, r2].filter(r => r.status === HTTP_STATUS.CREATED);
      const fallidos = [r1, r2].filter(r => r.status === HTTP_STATUS.BAD_REQUEST);
      expect(exitosos).toHaveLength(1);
      expect(fallidos).toHaveLength(1);
      expect(fallidos[0].body.code).toBe('INSUFFICIENT_FUNDS');

      // El saldo no puede quedar negativo ni perder actualizaciones
      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(200000);

      const retiros = await Movimiento.find({ tipo: MOVEMENT_TYPES.RETIRO, cuentaOrigen: cuenta1._id });
      expect(retiros).toHaveLength(1);
    });

    test('Dos depósitos simultáneos con referencias distintas no pierden actualizaciones', async () => {
      const [r1, r2] = await Promise.all([
        request(app).post('/api/cuenta/deposito').send({ cuentaId: cuenta1._id.toString(), monto: 100000 }),
        request(app).post('/api/cuenta/deposito').send({ cuentaId: cuenta1._id.toString(), monto: 200000 }),
      ]);

      expect(r1.status).toBe(HTTP_STATUS.CREATED);
      expect(r2.status).toBe(HTTP_STATUS.CREATED);

      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(800000); // 500000 + 100000 + 200000
    });

    test('Solicitudes simultáneas con la misma referencia procesan el depósito una sola vez', async () => {
      const referencia = 'CONC_DEP_001';
      const [r1, r2] = await Promise.all([
        request(app).post('/api/cuenta/deposito').send({ cuentaId: cuenta1._id.toString(), monto: 100000, referencia }),
        request(app).post('/api/cuenta/deposito').send({ cuentaId: cuenta1._id.toString(), monto: 100000, referencia }),
      ]);

      // Exactamente una solicitud crea el recurso; la otra responde idempotente
      const creadas = [r1, r2].filter(r => r.status === HTTP_STATUS.CREATED);
      const idempotentes = [r1, r2].filter(r => r.status === HTTP_STATUS.OK && r.body.idempotente === true);
      expect(creadas).toHaveLength(1);
      expect(idempotentes).toHaveLength(1);

      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(600000); // solo un depósito aplicado

      const movimientos = await Movimiento.countDocuments({ referencia });
      expect(movimientos).toBe(1);
    });

    test('Solicitudes simultáneas con la misma referencia procesan el retiro una sola vez', async () => {
      const referencia = 'CONC_RET_001';
      const [r1, r2] = await Promise.all([
        request(app).post('/api/cuenta/retiro').send({ cuentaId: cuenta1._id.toString(), monto: 50000, referencia }),
        request(app).post('/api/cuenta/retiro').send({ cuentaId: cuenta1._id.toString(), monto: 50000, referencia }),
      ]);

      const creadas = [r1, r2].filter(r => r.status === HTTP_STATUS.CREATED);
      const idempotentes = [r1, r2].filter(r => r.status === HTTP_STATUS.OK && r.body.idempotente === true);
      expect(creadas).toHaveLength(1);
      expect(idempotentes).toHaveLength(1);

      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(450000); // solo un retiro aplicado

      const movimientos = await Movimiento.countDocuments({ referencia });
      expect(movimientos).toBe(1);
    });

    test('Transferencias simultáneas en direcciones opuestas conservan el dinero total', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const totalInicial = (await Cuenta.find({ activa: true })).reduce((s, c) => s + c.saldo, 0);

      const [r1, r2] = await Promise.all([
        request(app).post('/api/cuenta/transferencia')
          .send({ cuentaOrigenId: cuenta1._id.toString(), cuentaDestinoId: cuenta2._id.toString(), monto: 100000 }),
        request(app).post('/api/cuenta/transferencia')
          .send({ cuentaOrigenId: cuenta2._id.toString(), cuentaDestinoId: cuenta1._id.toString(), monto: 100000 }),
      ]);

      expect(r1.status).toBe(HTTP_STATUS.CREATED);
      expect(r2.status).toBe(HTTP_STATUS.CREATED);

      // Sin pérdida de actualizaciones: cada cuenta queda con su saldo original
      const c1 = await Cuenta.findById(cuenta1._id);
      const c2 = await Cuenta.findById(cuenta2._id);
      expect(c1.saldo).toBe(500000);
      expect(c2.saldo).toBe(1250000);

      const totalFinal = (await Cuenta.find({ activa: true })).reduce((s, c) => s + c.saldo, 0);
      expect(totalFinal).toBe(totalInicial);
    });

    test('Transferencias simultáneas sobre los mismos fondos no producen sobregiro', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      // c2 tiene 1250000; tres transferencias de 500000 en paralelo: solo dos pueden salir
      const [r1, r2, r3] = await Promise.all([
        request(app).post('/api/cuenta/transferencia')
          .send({ cuentaOrigenId: cuenta2._id.toString(), cuentaDestinoId: cuenta3._id.toString(), monto: 500000 }),
        request(app).post('/api/cuenta/transferencia')
          .send({ cuentaOrigenId: cuenta2._id.toString(), cuentaDestinoId: cuenta3._id.toString(), monto: 500000 }),
        request(app).post('/api/cuenta/transferencia')
          .send({ cuentaOrigenId: cuenta2._id.toString(), cuentaDestinoId: cuenta3._id.toString(), monto: 500000 }),
      ]);

      const exitosas = [r1, r2, r3].filter(r => r.status === HTTP_STATUS.CREATED);
      const fallidas = [r1, r2, r3].filter(r => r.status === HTTP_STATUS.BAD_REQUEST);
      expect(exitosas).toHaveLength(2);
      expect(fallidas).toHaveLength(1);
      expect(fallidas[0].body.code).toBe('INSUFFICIENT_FUNDS');

      const c2 = await Cuenta.findById(cuenta2._id);
      expect(c2.saldo).toBe(250000);

      // El dinero total del sistema se conserva
      const total = (await Cuenta.find({})).reduce((s, c) => s + c.saldo, 0);
      expect(total).toBe(1825000); // 500000 + 250000 + 1075000
    });
  });

  describe('Idempotencia - conflictos por reutilización de referencia', () => {
    test('Depósito: reutilizar la referencia con un monto distinto → 409', async () => {
      const referencia = 'CONFL_DEP_001';

      await request(app)
        .post('/api/cuenta/deposito')
        .send({ cuentaId: cuenta1._id.toString(), monto: 50000, referencia })
        .expect(HTTP_STATUS.CREATED);

      const response = await request(app)
        .post('/api/cuenta/deposito')
        .send({ cuentaId: cuenta1._id.toString(), monto: 60000, referencia })
        .expect(HTTP_STATUS.CONFLICT);

      expect(response.body.code).toBe('REFERENCE_CONFLICT');

      // El saldo no cambió por la solicitud conflictuada
      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(550000);
    });

    test('Depósito: reutilizar la referencia de un retiro → 409', async () => {
      const referencia = 'CONFL_MIXTA_001';

      await request(app)
        .post('/api/cuenta/retiro')
        .send({ cuentaId: cuenta1._id.toString(), monto: 20000, referencia })
        .expect(HTTP_STATUS.CREATED);

      const response = await request(app)
        .post('/api/cuenta/deposito')
        .send({ cuentaId: cuenta1._id.toString(), monto: 20000, referencia })
        .expect(HTTP_STATUS.CONFLICT);

      expect(response.body.code).toBe('REFERENCE_CONFLICT');

      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(480000); // solo el retiro aplicado
    });

    test('Retiro: reutilizar la referencia con un monto distinto → 409', async () => {
      const referencia = 'CONFL_RET_001';

      await request(app)
        .post('/api/cuenta/retiro')
        .send({ cuentaId: cuenta1._id.toString(), monto: 30000, referencia })
        .expect(HTTP_STATUS.CREATED);

      const response = await request(app)
        .post('/api/cuenta/retiro')
        .send({ cuentaId: cuenta1._id.toString(), monto: 40000, referencia })
        .expect(HTTP_STATUS.CONFLICT);

      expect(response.body.code).toBe('REFERENCE_CONFLICT');

      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(470000);
    });

    test('Transferencia: la repetición con la referencia original encuentra los movimientos _OUT/_IN', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const referencia = 'TRF_SUFIX_001';
      const cuerpo = {
        cuentaOrigenId: cuenta2._id.toString(),
        cuentaDestinoId: cuenta3._id.toString(),
        monto: 200000,
        referencia,
      };

      await request(app).post('/api/cuenta/transferencia').send(cuerpo).expect(HTTP_STATUS.CREATED);

      // Los movimientos se almacenan con las referencias con sufijo
      const conSufijo = await Movimiento.find({ referencia: { $in: ['TRF_SUFIX_001_OUT', 'TRF_SUFIX_001_IN'] } });
      expect(conSufijo).toHaveLength(2);

      // La repetición con la referencia ORIGINAL (sin sufijo) es reconocida como idempotente
      const response = await request(app).post('/api/cuenta/transferencia').send(cuerpo).expect(HTTP_STATUS.OK);

      expect(response.body.idempotente).toBe(true);
      expect(response.body.data.cuentaOrigen).toBeDefined();
      expect(response.body.data.cuentaDestino).toBeDefined();
      expect(response.body.data.movimientoEnviado).toBeDefined();
      expect(response.body.data.movimientoRecibido).toBeDefined();

      // Sin doble efecto en los saldos
      const [origen, destino] = await Promise.all([
        Cuenta.findById(cuenta2._id),
        Cuenta.findById(cuenta3._id),
      ]);
      expect(origen.saldo).toBe(1050000);
      expect(destino.saldo).toBe(275000);
      expect(await Movimiento.countDocuments({ referencia: { $in: ['TRF_SUFIX_001_OUT', 'TRF_SUFIX_001_IN'] } })).toBe(2);
    });

    test('Transferencia: reutilizar la referencia con un monto distinto → 409', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const referencia = 'CONFL_TRF_001';
      await request(app)
        .post('/api/cuenta/transferencia')
        .send({ cuentaOrigenId: cuenta2._id.toString(), cuentaDestinoId: cuenta3._id.toString(), monto: 100000, referencia })
        .expect(HTTP_STATUS.CREATED);

      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({ cuentaOrigenId: cuenta2._id.toString(), cuentaDestinoId: cuenta3._id.toString(), monto: 150000, referencia })
        .expect(HTTP_STATUS.CONFLICT);

      expect(response.body.code).toBe('REFERENCE_CONFLICT');

      const [origen, destino] = await Promise.all([
        Cuenta.findById(cuenta2._id),
        Cuenta.findById(cuenta3._id),
      ]);
      expect(origen.saldo).toBe(1150000);
      expect(destino.saldo).toBe(175000);
    });

    test('Transferencia: reutilizar la referencia hacia otra cuenta destino → 409', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const referencia = 'CONFL_TRF_002';
      await request(app)
        .post('/api/cuenta/transferencia')
        .send({ cuentaOrigenId: cuenta2._id.toString(), cuentaDestinoId: cuenta3._id.toString(), monto: 100000, referencia })
        .expect(HTTP_STATUS.CREATED);

      const response = await request(app)
        .post('/api/cuenta/transferencia')
        .send({ cuentaOrigenId: cuenta2._id.toString(), cuentaDestinoId: cuenta1._id.toString(), monto: 100000, referencia })
        .expect(HTTP_STATUS.CONFLICT);

      expect(response.body.code).toBe('REFERENCE_CONFLICT');

      // Solo se aplicó la primera transferencia
      const c1 = await Cuenta.findById(cuenta1._id);
      const c3 = await Cuenta.findById(cuenta3._id);
      expect(c1.saldo).toBe(500000);
      expect(c3.saldo).toBe(175000);
    });
  });

  describe('Rollback ante fallos', () => {
    test('Depósito: si falla la creación del movimiento, el saldo no cambia', async () => {
      const spy = jest.spyOn(Movimiento, 'create').mockRejectedValueOnce(new Error('fallo simulado de BD'));
      try {
        const response = await request(app)
          .post('/api/cuenta/deposito')
          .send({ cuentaId: cuenta1._id.toString(), monto: 100000, descripcion: 'Fallo simulado' })
          .expect(HTTP_STATUS.INTERNAL_SERVER_ERROR);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Error interno del servidor');
      } finally {
        spy.mockRestore();
      }

      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(500000);
      expect(await Movimiento.countDocuments({ cuentaDestino: cuenta1._id })).toBe(0);
    });

    test('Transferencia: si falla la creación de movimientos, ambos saldos quedan intactos', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      const spy = jest.spyOn(Movimiento, 'create').mockRejectedValueOnce(new Error('fallo simulado de BD'));
      try {
        await request(app)
          .post('/api/cuenta/transferencia')
          .send({
            cuentaOrigenId: cuenta2._id.toString(),
            cuentaDestinoId: cuenta3._id.toString(),
            monto: 200000,
          })
          .expect(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      } finally {
        spy.mockRestore();
      }

      const [origen, destino] = await Promise.all([
        Cuenta.findById(cuenta2._id),
        Cuenta.findById(cuenta3._id),
      ]);
      expect(origen.saldo).toBe(1250000);
      expect(destino.saldo).toBe(75000);
      expect(await Movimiento.countDocuments({})).toBe(0);
    });
  });

  describe('Consistencia del historial y los saldos', () => {
    test('Los saldos anterior/posterior de los movimientos forman una cadena coherente con el saldo de la cuenta', async () => {
      await request(app)
        .post('/api/cuenta/deposito')
        .send({ cuentaId: cuenta1._id.toString(), monto: 100000 })
        .expect(HTTP_STATUS.CREATED);

      await request(app)
        .post('/api/cuenta/retiro')
        .send({ cuentaId: cuenta1._id.toString(), monto: 30000 })
        .expect(HTTP_STATUS.CREATED);

      const cuentaActualizada = await Cuenta.findById(cuenta1._id);
      expect(cuentaActualizada.saldo).toBe(570000);

      const depositos = await Movimiento.find({ tipo: MOVEMENT_TYPES.DEPOSITO, cuentaDestino: cuenta1._id });
      const retiros = await Movimiento.find({ tipo: MOVEMENT_TYPES.RETIRO, cuentaOrigen: cuenta1._id });
      expect(depositos).toHaveLength(1);
      expect(retiros).toHaveLength(1);

      // Depósito: 500000 → 600000
      expect(depositos[0].saldoAnteriorDestino).toBe(500000);
      expect(depositos[0].saldoPosteriorDestino).toBe(600000);

      // Retiro: parte del saldo posterior al depósito → 570000
      expect(retiros[0].saldoAnteriorOrigen).toBe(600000);
      expect(retiros[0].saldoPosteriorOrigen).toBe(570000);
      expect(retiros[0].saldoPosteriorOrigen).toBe(cuentaActualizada.saldo);
    });

    test('Los movimientos de transferencia registran saldos anterior y posterior de ambas cuentas', async () => {
      if (!transactionsSupported) {
        console.log('  ⏭ Test omitido: replica set no configurado');
        return;
      }

      await request(app)
        .post('/api/cuenta/transferencia')
        .send({ cuentaOrigenId: cuenta2._id.toString(), cuentaDestinoId: cuenta3._id.toString(), monto: 200000 })
        .expect(HTTP_STATUS.CREATED);

      const movOut = await Movimiento.findOne({ tipo: MOVEMENT_TYPES.TRANSFERENCIA_ENVIADA });
      const movIn = await Movimiento.findOne({ tipo: MOVEMENT_TYPES.TRANSFERENCIA_RECIBIDA });

      expect(movOut.saldoAnteriorOrigen).toBe(1250000);
      expect(movOut.saldoPosteriorOrigen).toBe(1050000);
      expect(movOut.saldoAnteriorDestino).toBe(75000);
      expect(movOut.saldoPosteriorDestino).toBe(275000);

      expect(movIn.saldoAnteriorOrigen).toBe(1250000);
      expect(movIn.saldoPosteriorOrigen).toBe(1050000);
      expect(movIn.saldoAnteriorDestino).toBe(75000);
      expect(movIn.saldoPosteriorDestino).toBe(275000);

      // El saldo vigente de cada cuenta coincide con el saldo posterior registrado
      const [origen, destino] = await Promise.all([
        Cuenta.findById(cuenta2._id),
        Cuenta.findById(cuenta3._id),
      ]);
      expect(origen.saldo).toBe(movIn.saldoPosteriorOrigen);
      expect(destino.saldo).toBe(movIn.saldoPosteriorDestino);
    });
  });
});