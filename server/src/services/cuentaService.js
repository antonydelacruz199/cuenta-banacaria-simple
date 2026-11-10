import Cuenta from '../models/Cuenta.js';
import Movimiento from '../models/Movimiento.js';
import { areTransactionsSupported } from '../config/database.js';
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  MOVEMENT_TYPES,
  CURRENCY,
  LIMITS,
  HTTP_STATUS,
} from '../config/constants.js';
import mongoose from 'mongoose';

const MENSAJE_IDEMPOTENTE = 'Operación ya procesada (idempotente)';

// Generar referencia única para idempotencia
const generarReferencia = (prefijo) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefijo}_${timestamp}_${random}`.toUpperCase();
};

// Crear un error con estado HTTP, código y detalles opcionales
const lanzarError = (statusCode, code, message, details = undefined) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  if (details !== undefined) error.details = details;
  return error;
};

const idsIguales = (a, b) => String(a) === String(b);

// Normalizar la referencia enviada por el cliente (trim) o generar una nueva
const normalizarReferencia = (referencia, prefijo) => {
  const limpio = referencia ? String(referencia).trim() : '';
  return limpio || generarReferencia(prefijo);
};

// Buscar movimientos por referencia de operación, incluyendo las variantes _OUT/_IN
// que se almacenan para transferencias
const buscarMovimientosPorReferencia = (ref) => {
  return Movimiento.find({
    referencia: { $in: [ref, `${ref}_OUT`, `${ref}_IN`] },
  })
    .sort({ fecha: 1 })
    .limit(2);
};

// Validación de monto a nivel de servicio (defensa adicional a los validators HTTP)
const validarMontoInterno = (monto) => {
  if (typeof monto !== 'number' || !Number.isFinite(monto) || !Number.isInteger(monto)) {
    throw lanzarError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT', ERROR_MESSAGES.INVALID_AMOUNT);
  }
  if (monto < LIMITS.MIN_AMOUNT) {
    throw lanzarError(HTTP_STATUS.BAD_REQUEST, 'INVALID_AMOUNT', ERROR_MESSAGES.AMOUNT_MUST_BE_POSITIVE);
  }
  if (monto > LIMITS.MAX_AMOUNT) {
    throw lanzarError(HTTP_STATUS.BAD_REQUEST, 'AMOUNT_EXCEEDS_MAX', ERROR_MESSAGES.AMOUNT_EXCEEDS_MAX);
  }
};

// Las operaciones monetarias requieren transacciones (replica set rs0).
// Sin transacciones no se permite modificar el saldo: no hay camino no atómico.
const asegurarTransacciones = async () => {
  const soportadas = await areTransactionsSupported();
  if (!soportadas) {
    throw lanzarError(
      HTTP_STATUS.SERVICE_UNAVAILABLE,
      'TRANSACTIONS_NOT_SUPPORTED',
      ERROR_MESSAGES.TRANSACTIONS_NOT_SUPPORTED
    );
  }
};

const errorConflictoReferencia = () => lanzarError(
  HTTP_STATUS.CONFLICT,
  'REFERENCE_CONFLICT',
  ERROR_MESSAGES.REFERENCE_CONFLICT
);

// Detectar E11000 (índice único) sobre el campo referencia de Movimiento.
// La garantía final de idempotencia ante solicitudes simultáneas es el índice único:
// si una segunda transacción pierde la carrera, aborta con E11000 y se responde de forma idempotente.
const esDuplicadoReferencia = (err) => {
  if (!err) return false;
  const writeError = Array.isArray(err.writeErrors) ? err.writeErrors[0] : null;
  if (err.code === 11000 && err.keyPattern && 'referencia' in err.keyPattern) return true;
  if (writeError && writeError.code === 11000 && writeError.keyPattern && 'referencia' in writeError.keyPattern) return true;
  return err.code === 11000 && String(err.message || '').includes('referencia');
};

const respuestaIdempotente = (cuenta, movimiento) => ({
  cuenta: cuenta.toPublicJSON(),
  movimiento: movimiento.toPublicJSON(),
  mensaje: MENSAJE_IDEMPOTENTE,
  idempotente: true,
});

// Verificar que un movimiento existente corresponda exactamente a la operación
// que se intenta reenviar con la misma referencia (misma operación, monto y cuentas)
const esCompatibleDeposito = (mov, monto, cuentaId) =>
  mov.tipo === MOVEMENT_TYPES.DEPOSITO &&
  mov.monto === monto &&
  idsIguales(mov.cuentaDestino, cuentaId);

const esCompatibleRetiro = (mov, monto, cuentaId) =>
  mov.tipo === MOVEMENT_TYPES.RETIRO &&
  mov.monto === monto &&
  idsIguales(mov.cuentaOrigen, cuentaId);

// Verificar que los movimientos _OUT/_IN encontrados correspondan a la transferencia
// reenviada (mismo monto, origen y destino, aunque cambie el formato del identificador)
const verificarCompatibilidadTransferencia = async (existentes, ref, monto, cuentaOrigenId, cuentaDestinoId) => {
  const origen = await Cuenta.buscarPorIdONumero(cuentaOrigenId);
  if (!origen) {
    throw lanzarError(HTTP_STATUS.NOT_FOUND, 'ORIGIN_ACCOUNT_NOT_FOUND', ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
  }
  const destino = await Cuenta.buscarPorIdONumero(cuentaDestinoId);
  if (!destino) {
    throw lanzarError(HTTP_STATUS.NOT_FOUND, 'DESTINATION_ACCOUNT_NOT_FOUND', ERROR_MESSAGES.DESTINATION_ACCOUNT_NOT_FOUND);
  }

  const movEnviado = existentes.find(m => m.tipo === MOVEMENT_TYPES.TRANSFERENCIA_ENVIADA && m.referencia === `${ref}_OUT`);
  const movRecibido = existentes.find(m => m.tipo === MOVEMENT_TYPES.TRANSFERENCIA_RECIBIDA && m.referencia === `${ref}_IN`);

  const compatible =
    !!movEnviado &&
    !!movRecibido &&
    movEnviado.monto === monto &&
    movRecibido.monto === monto &&
    idsIguales(movEnviado.cuentaOrigen, origen._id) &&
    idsIguales(movEnviado.cuentaDestino, destino._id) &&
    idsIguales(movRecibido.cuentaOrigen, origen._id) &&
    idsIguales(movRecibido.cuentaDestino, destino._id);

  if (!compatible) throw errorConflictoReferencia();

  // Estado actual de ambas cuentas (solo lectura, fuera de la transacción)
  const origenActual = await Cuenta.findById(origen._id);
  const destinoActual = await Cuenta.findById(destino._id);

  return {
    cuentaOrigen: origenActual.toPublicJSON(),
    cuentaDestino: destinoActual.toPublicJSON(),
    movimientoEnviado: movEnviado.toPublicJSON(),
    movimientoRecibido: movRecibido.toPublicJSON(),
    mensaje: MENSAJE_IDEMPOTENTE,
    idempotente: true,
  };
};

// Obtener cuenta por ID o número de cuenta
export const obtenerCuenta = async (identificador) => {
  const cuenta = await Cuenta.buscarPorIdONumero(identificador);
  if (!cuenta) {
    throw lanzarError(HTTP_STATUS.NOT_FOUND, 'ACCOUNT_NOT_FOUND', ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
  }
  if (!cuenta.activa) {
    throw lanzarError(HTTP_STATUS.BAD_REQUEST, 'ACCOUNT_INACTIVE', 'La cuenta está inactiva');
  }
  return cuenta;
};

// Depósito
export const realizarDeposito = async (cuentaId, monto, descripcion = '', referencia = null) => {
  validarMontoInterno(monto);
  const cuenta = await obtenerCuenta(cuentaId);
  const ref = normalizarReferencia(referencia, 'DEP');

  // Búsqueda previa por referencia (camino rápido; la garantía ante concurrencia es el índice único)
  const existentes = await buscarMovimientosPorReferencia(ref);
  if (existentes.length > 0) {
    const mov = existentes[0];
    if (!esCompatibleDeposito(mov, monto, cuenta._id)) throw errorConflictoReferencia();
    return respuestaIdempotente(cuenta, mov);
  }

  await asegurarTransacciones();

  const session = await mongoose.startSession();
  try {
    const resultado = await session.withTransaction(async () => {
      // $inc es aditivo y atómico: nunca sobrescribe el saldo con un valor absoluto leído previamente
      const cuentaActualizada = await Cuenta.findOneAndUpdate(
        { _id: cuenta._id },
        { $inc: { saldo: monto } },
        { session, returnDocument: 'after' }
      );
      if (!cuentaActualizada) {
        throw lanzarError(HTTP_STATUS.NOT_FOUND, 'ACCOUNT_NOT_FOUND', ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
      }

      const saldoPosterior = cuentaActualizada.saldo;
      const saldoAnterior = saldoPosterior - monto;

      const movimientos = await Movimiento.create([{
        tipo: MOVEMENT_TYPES.DEPOSITO,
        monto,
        cuentaDestino: cuenta._id,
        descripcion: descripcion || 'Depósito en cuenta',
        referencia: ref,
        saldoAnteriorDestino: saldoAnterior,
        saldoPosteriorDestino: saldoPosterior,
      }], { session });

      return { cuenta: cuentaActualizada, movimiento: movimientos[0] };
    });

    return {
      cuenta: resultado.cuenta.toPublicJSON(),
      movimiento: resultado.movimiento.toPublicJSON(),
      mensaje: SUCCESS_MESSAGES.DEPOSIT_SUCCESS,
      idempotente: false,
    };
  } catch (err) {
    // Otra solicitud simultánea con la misma referencia ganó la carrera: la transacción
    // abortó por el índice único y ningún cambio quedó aplicado en esta
    if (esDuplicadoReferencia(err)) {
      const repetidos = await buscarMovimientosPorReferencia(ref);
      const mov = repetidos[0];
      if (mov) {
        if (!esCompatibleDeposito(mov, monto, cuenta._id)) throw errorConflictoReferencia();
        return respuestaIdempotente(cuenta, mov);
      }
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

// Retiro
export const realizarRetiro = async (cuentaId, monto, descripcion = '', referencia = null) => {
  validarMontoInterno(monto);
  const cuenta = await obtenerCuenta(cuentaId);
  const ref = normalizarReferencia(referencia, 'RET');

  // Búsqueda previa por referencia (camino rápido; la garantía ante concurrencia es el índice único)
  const existentes = await buscarMovimientosPorReferencia(ref);
  if (existentes.length > 0) {
    const mov = existentes[0];
    if (!esCompatibleRetiro(mov, monto, cuenta._id)) throw errorConflictoReferencia();
    return respuestaIdempotente(cuenta, mov);
  }

  await asegurarTransacciones();

  const session = await mongoose.startSession();
  try {
    const resultado = await session.withTransaction(async () => {
      // Actualización condicional atómica: el descuento solo aplica si el saldo actual
      // cubre el monto. Dos retiros concurrentes no pueden consumir el mismo saldo:
      // el filtro se evalúa sobre el valor vigente en el momento de la escritura.
      const cuentaActualizada = await Cuenta.findOneAndUpdate(
        { _id: cuenta._id, saldo: { $gte: monto } },
        { $inc: { saldo: -monto } },
        { session, returnDocument: 'after' }
      );

      if (!cuentaActualizada) {
        // Releer dentro de la transacción para informar el saldo real vigente
        const cuentaReleida = await Cuenta.findById(cuenta._id).session(session);
        if (!cuentaReleida) {
          throw lanzarError(HTTP_STATUS.NOT_FOUND, 'ACCOUNT_NOT_FOUND', ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
        }
        throw lanzarError(HTTP_STATUS.BAD_REQUEST, 'INSUFFICIENT_FUNDS', ERROR_MESSAGES.INSUFFICIENT_FUNDS, {
          saldoActual: cuentaReleida.saldo,
          montoSolicitado: monto,
          faltante: monto - cuentaReleida.saldo,
        });
      }

      const saldoPosterior = cuentaActualizada.saldo;
      const saldoAnterior = saldoPosterior + monto;

      const movimientos = await Movimiento.create([{
        tipo: MOVEMENT_TYPES.RETIRO,
        monto,
        cuentaOrigen: cuenta._id,
        descripcion: descripcion || 'Retiro de cuenta',
        referencia: ref,
        saldoAnteriorOrigen: saldoAnterior,
        saldoPosteriorOrigen: saldoPosterior,
      }], { session });

      return { cuenta: cuentaActualizada, movimiento: movimientos[0] };
    });

    return {
      cuenta: resultado.cuenta.toPublicJSON(),
      movimiento: resultado.movimiento.toPublicJSON(),
      mensaje: SUCCESS_MESSAGES.WITHDRAWAL_SUCCESS,
      idempotente: false,
    };
  } catch (err) {
    if (esDuplicadoReferencia(err)) {
      const repetidos = await buscarMovimientosPorReferencia(ref);
      const mov = repetidos[0];
      if (mov) {
        if (!esCompatibleRetiro(mov, monto, cuenta._id)) throw errorConflictoReferencia();
        return respuestaIdempotente(cuenta, mov);
      }
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

// Transferencia
export const realizarTransferencia = async (cuentaOrigenId, cuentaDestinoId, monto, descripcion = '', referencia = null) => {
  validarMontoInterno(monto);

  // Rechazo rápido si los identificadores crudos son idénticos.
  // La comparación definitiva se hace sobre los _id resueltos dentro de la transacción,
  // por lo que también se rechaza la misma cuenta referida por ObjectId y número de cuenta.
  if (String(cuentaOrigenId).trim().toUpperCase() === String(cuentaDestinoId).trim().toUpperCase()) {
    throw lanzarError(HTTP_STATUS.BAD_REQUEST, 'SAME_ACCOUNT_TRANSFER', ERROR_MESSAGES.SAME_ACCOUNT_TRANSFER);
  }

  const ref = normalizarReferencia(referencia, 'TRF');

  // Búsqueda previa por referencia, incluyendo las variantes _OUT/_IN almacenadas.
  // Esto corrige la inconsistencia original: la transferencia guardaba referencias con
  // sufijo pero la repetición buscaba la referencia sin sufijo y volvía a ejecutarse.
  const existentes = await buscarMovimientosPorReferencia(ref);
  if (existentes.length > 0) {
    return verificarCompatibilidadTransferencia(existentes, ref, monto, cuentaOrigenId, cuentaDestinoId);
  }

  await asegurarTransacciones();

  const session = await mongoose.startSession();
  try {
    const resultado = await session.withTransaction(async () => {
      // Resolver ambas cuentas dentro de la transacción (secuencial, sin Promise.all:
      // las operaciones en paralelo no están permitidas dentro de una sesión transaccional)
      const cuentaOrigen = await Cuenta.buscarPorIdONumero(cuentaOrigenId, session);
      if (!cuentaOrigen) {
        throw lanzarError(HTTP_STATUS.NOT_FOUND, 'ORIGIN_ACCOUNT_NOT_FOUND', ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
      }

      const cuentaDestino = await Cuenta.buscarPorIdONumero(cuentaDestinoId, session);
      if (!cuentaDestino) {
        throw lanzarError(HTTP_STATUS.NOT_FOUND, 'DESTINATION_ACCOUNT_NOT_FOUND', ERROR_MESSAGES.DESTINATION_ACCOUNT_NOT_FOUND);
      }

      // Misma cuenta aunque los identificadores sean distintos (ObjectId vs número de cuenta)
      if (idsIguales(cuentaOrigen._id, cuentaDestino._id)) {
        throw lanzarError(HTTP_STATUS.BAD_REQUEST, 'SAME_ACCOUNT_TRANSFER', ERROR_MESSAGES.SAME_ACCOUNT_TRANSFER);
      }

      if (!cuentaOrigen.activa || !cuentaDestino.activa) {
        throw lanzarError(HTTP_STATUS.BAD_REQUEST, 'ACCOUNT_INACTIVE', 'Una de las cuentas está inactiva');
      }

      // Débito condicional atómico sobre el saldo vigente: si otro retiro simultáneo
      // consumió el saldo, el filtro ya no coincide y la actualización no aplica
      const origenActualizada = await Cuenta.findOneAndUpdate(
        { _id: cuentaOrigen._id, saldo: { $gte: monto } },
        { $inc: { saldo: -monto } },
        { session, returnDocument: 'after' }
      );

      if (!origenActualizada) {
        const cuentaReleida = await Cuenta.findById(cuentaOrigen._id).session(session);
        throw lanzarError(HTTP_STATUS.BAD_REQUEST, 'INSUFFICIENT_FUNDS', ERROR_MESSAGES.INSUFFICIENT_FUNDS, {
          saldoActual: cuentaReleida ? cuentaReleida.saldo : 0,
          montoSolicitado: monto,
          faltante: monto - (cuentaReleida ? cuentaReleida.saldo : 0),
        });
      }

      const destinoActualizada = await Cuenta.findOneAndUpdate(
        { _id: cuentaDestino._id },
        { $inc: { saldo: monto } },
        { session, returnDocument: 'after' }
      );

      const saldoPosteriorOrigen = origenActualizada.saldo;
      const saldoAnteriorOrigen = saldoPosteriorOrigen + monto;
      const saldoPosteriorDestino = destinoActualizada.saldo;
      const saldoAnteriorDestino = saldoPosteriorDestino - monto;

      // Movimientos de salida y entrada, secuencialmente dentro de la misma transacción
      const movimientosEnviados = await Movimiento.create([{
        tipo: MOVEMENT_TYPES.TRANSFERENCIA_ENVIADA,
        monto,
        cuentaOrigen: cuentaOrigen._id,
        cuentaDestino: cuentaDestino._id,
        descripcion: descripcion || `Transferencia a ${cuentaDestino.numeroCuenta}`,
        referencia: `${ref}_OUT`,
        saldoAnteriorOrigen,
        saldoPosteriorOrigen,
        saldoAnteriorDestino,
        saldoPosteriorDestino,
      }], { session });

      const movimientosRecibidos = await Movimiento.create([{
        tipo: MOVEMENT_TYPES.TRANSFERENCIA_RECIBIDA,
        monto,
        cuentaOrigen: cuentaOrigen._id,
        cuentaDestino: cuentaDestino._id,
        descripcion: descripcion || `Transferencia de ${cuentaOrigen.numeroCuenta}`,
        referencia: `${ref}_IN`,
        saldoAnteriorOrigen,
        saldoPosteriorOrigen,
        saldoAnteriorDestino,
        saldoPosteriorDestino,
      }], { session });

      return {
        cuentaOrigen: origenActualizada,
        cuentaDestino: destinoActualizada,
        movimientoEnviado: movimientosEnviados[0],
        movimientoRecibido: movimientosRecibidos[0],
      };
    });

    return {
      cuentaOrigen: resultado.cuentaOrigen.toPublicJSON(),
      cuentaDestino: resultado.cuentaDestino.toPublicJSON(),
      movimientoEnviado: resultado.movimientoEnviado.toPublicJSON(),
      movimientoRecibido: resultado.movimientoRecibido.toPublicJSON(),
      mensaje: SUCCESS_MESSAGES.TRANSFER_SUCCESS,
      idempotente: false,
    };
  } catch (err) {
    if (esDuplicadoReferencia(err)) {
      // Otra solicitud simultánea con la misma referencia completó primero:
      // responder de forma idempotente o conflictuar según compatibilidad
      const repetidos = await buscarMovimientosPorReferencia(ref);
      if (repetidos.length > 0) {
        return verificarCompatibilidadTransferencia(repetidos, ref, monto, cuentaOrigenId, cuentaDestinoId);
      }
    }
    throw err;
  } finally {
    await session.endSession();
  }
};

// Obtener historial
export const obtenerHistorial = async (cuentaId, pagina = 1, limite = 20) => {
  const cuenta = await obtenerCuenta(cuentaId);
  return Movimiento.obtenerHistorialCuenta(cuenta._id, pagina, limite);
};

// Formatear respuesta de cuenta con saldo formateado
export const formatearRespuestaCuenta = (cuenta) => {
  const saldoEnMoneda = cuenta.saldo / Math.pow(10, CURRENCY.DECIMALS);

  return {
    id: cuenta._id,
    numeroCuenta: cuenta.numeroCuenta,
    titular: cuenta.titular,
    saldo: cuenta.saldo,
    saldoFormateado: `${CURRENCY.SYMBOL} ${saldoEnMoneda.toLocaleString('es-PE', {
      minimumFractionDigits: CURRENCY.DECIMALS,
      maximumFractionDigits: CURRENCY.DECIMALS,
    })}`,
    moneda: CURRENCY.CODE,
    activa: cuenta.activa,
    fechaCreacion: cuenta.fechaCreacion,
    fechaActualizacion: cuenta.fechaActualizacion,
  };
};
