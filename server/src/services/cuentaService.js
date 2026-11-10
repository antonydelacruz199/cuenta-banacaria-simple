import Cuenta from '../models/Cuenta.js';
import Movimiento from '../models/Movimiento.js';
import { areTransactionsSupported } from '../config/database.js';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, MOVEMENT_TYPES, CURRENCY } from '../config/constants.js';
import mongoose from 'mongoose';

// Generar referencia única para idempotencia
const generarReferencia = (prefijo) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefijo}_${timestamp}_${random}`.toUpperCase();
};

// Obtener cuenta por ID o número de cuenta
export const obtenerCuenta = async (identificador) => {
  const cuenta = await Cuenta.buscarPorIdONumero(identificador);
  if (!cuenta) {
    const error = new Error(ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
    error.statusCode = 404;
    error.code = 'ACCOUNT_NOT_FOUND';
    throw error;
  }
  if (!cuenta.activa) {
    const error = new Error('La cuenta está inactiva');
    error.statusCode = 400;
    error.code = 'ACCOUNT_INACTIVE';
    throw error;
  }
  return cuenta;
};

// Depósito
export const realizarDeposito = async (cuentaId, monto, descripcion = '', referencia = null) => {
  const cuenta = await obtenerCuenta(cuentaId);
  const ref = referencia || generarReferencia('DEP');
  
  // Verificar idempotencia
  const movimientoExistente = await Movimiento.findOne({ referencia: ref });
  if (movimientoExistente) {
    return {
      cuenta: cuenta.toPublicJSON(),
      movimiento: movimientoExistente.toPublicJSON(),
      mensaje: 'Operación ya procesada (idempotente)',
      idempotente: true,
    };
  }

  const saldoAnterior = cuenta.saldo;
  const saldoNuevo = saldoAnterior + monto;
  
  // Actualizar cuenta y crear movimiento en transacción si está disponible
  const transactionsSupported = await areTransactionsSupported();
  
  if (transactionsSupported) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        cuenta.saldo = saldoNuevo;
        await cuenta.save({ session });
        
        const movimiento = new Movimiento({
          tipo: MOVEMENT_TYPES.DEPOSITO,
          monto,
          cuentaDestino: cuenta._id,
          descripcion: descripcion || 'Depósito en cuenta',
          referencia: ref,
          saldoAnteriorDestino: saldoAnterior,
          saldoPosteriorDestino: saldoNuevo,
        });
        await movimiento.save({ session });
      });
      
      return {
        cuenta: cuenta.toPublicJSON(),
        movimiento: (await Movimiento.findOne({ referencia: ref })).toPublicJSON(),
        mensaje: SUCCESS_MESSAGES.DEPOSIT_SUCCESS,
        idempotente: false,
      };
    } finally {
      await session.endSession();
    }
  } else {
    // Sin transacciones: operaciones secuenciales con verificación
    cuenta.saldo = saldoNuevo;
    await cuenta.save();
    
    const movimiento = new Movimiento({
      tipo: MOVEMENT_TYPES.DEPOSITO,
      monto,
      cuentaDestino: cuenta._id,
      descripcion: descripcion || 'Depósito en cuenta',
      referencia: ref,
      saldoAnteriorDestino: saldoAnterior,
      saldoPosteriorDestino: saldoNuevo,
    });
    await movimiento.save();
    
    return {
      cuenta: cuenta.toPublicJSON(),
      movimiento: movimiento.toPublicJSON(),
      mensaje: SUCCESS_MESSAGES.DEPOSIT_SUCCESS,
      idempotente: false,
      advertencia: 'Transacción no atómica (replica set no configurado)',
    };
  }
};

// Retiro
export const realizarRetiro = async (cuentaId, monto, descripcion = '', referencia = null) => {
  const cuenta = await obtenerCuenta(cuentaId);
  const ref = referencia || generarReferencia('RET');
  
  // Verificar idempotencia
  const movimientoExistente = await Movimiento.findOne({ referencia: ref });
  if (movimientoExistente) {
    return {
      cuenta: cuenta.toPublicJSON(),
      movimiento: movimientoExistente.toPublicJSON(),
      mensaje: 'Operación ya procesada (idempotente)',
      idempotente: true,
    };
  }

  // Validar fondos suficientes
  if (cuenta.saldo < monto) {
    const error = new Error(ERROR_MESSAGES.INSUFFICIENT_FUNDS);
    error.statusCode = 400;
    error.code = 'INSUFFICIENT_FUNDS';
    error.details = {
      saldoActual: cuenta.saldo,
      montoSolicitado: monto,
      faltante: monto - cuenta.saldo,
    };
    throw error;
  }

  const saldoAnterior = cuenta.saldo;
  const saldoNuevo = saldoAnterior - monto;
  
  const transactionsSupported = await areTransactionsSupported();
  
  if (transactionsSupported) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        cuenta.saldo = saldoNuevo;
        await cuenta.save({ session });
        
        const movimiento = new Movimiento({
          tipo: MOVEMENT_TYPES.RETIRO,
          monto,
          cuentaOrigen: cuenta._id,
          descripcion: descripcion || 'Retiro de cuenta',
          referencia: ref,
          saldoAnteriorOrigen: saldoAnterior,
          saldoPosteriorOrigen: saldoNuevo,
        });
        await movimiento.save({ session });
      });
      
      return {
        cuenta: cuenta.toPublicJSON(),
        movimiento: (await Movimiento.findOne({ referencia: ref })).toPublicJSON(),
        mensaje: SUCCESS_MESSAGES.WITHDRAWAL_SUCCESS,
        idempotente: false,
      };
    } finally {
      await session.endSession();
    }
  } else {
    cuenta.saldo = saldoNuevo;
    await cuenta.save();
    
    const movimiento = new Movimiento({
      tipo: MOVEMENT_TYPES.RETIRO,
      monto,
      cuentaOrigen: cuenta._id,
      descripcion: descripcion || 'Retiro de cuenta',
      referencia: ref,
      saldoAnteriorOrigen: saldoAnterior,
      saldoPosteriorOrigen: saldoNuevo,
    });
    await movimiento.save();
    
    return {
      cuenta: cuenta.toPublicJSON(),
      movimiento: movimiento.toPublicJSON(),
      mensaje: SUCCESS_MESSAGES.WITHDRAWAL_SUCCESS,
      idempotente: false,
      advertencia: 'Transacción no atómica (replica set no configurado)',
    };
  }
};

// Transferencia
export const realizarTransferencia = async (cuentaOrigenId, cuentaDestinoId, monto, descripcion = '', referencia = null) => {
  // Validar que no sea la misma cuenta
  if (cuentaOrigenId === cuentaDestinoId) {
    const error = new Error(ERROR_MESSAGES.SAME_ACCOUNT_TRANSFER);
    error.statusCode = 400;
    error.code = 'SAME_ACCOUNT_TRANSFER';
    throw error;
  }

  const ref = referencia || generarReferencia('TRF');
  
  // Verificar idempotencia
  const movimientoExistente = await Movimiento.findOne({ referencia: ref });
  if (movimientoExistente) {
    const cuentaOrigen = await Cuenta.findById(movimientoExistente.cuentaOrigen);
    return {
      cuentaOrigen: cuentaOrigen.toPublicJSON(),
      movimiento: movimientoExistente.toPublicJSON(),
      mensaje: 'Operación ya procesada (idempotente)',
      idempotente: true,
    };
  }

  const transactionsSupported = await areTransactionsSupported();
  
  if (!transactionsSupported) {
    const error = new Error(ERROR_MESSAGES.TRANSACTIONS_NOT_SUPPORTED);
    error.statusCode = 500;
    error.code = 'TRANSACTIONS_NOT_SUPPORTED';
    throw error;
  }

  const session = await mongoose.startSession();
  
  try {
    const resultado = await session.withTransaction(async () => {
      // Obtener ambas cuentas dentro de la transacción
      const [cuentaOrigen, cuentaDestino] = await Promise.all([
        Cuenta.findById(cuentaOrigenId).session(session),
        Cuenta.findById(cuentaDestinoId).session(session),
      ]);
      
      if (!cuentaOrigen) {
        const error = new Error(ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
        error.statusCode = 404;
        error.code = 'ORIGIN_ACCOUNT_NOT_FOUND';
        throw error;
      }
      if (!cuentaDestino) {
        const error = new Error(ERROR_MESSAGES.DESTINATION_ACCOUNT_NOT_FOUND);
        error.statusCode = 404;
        error.code = 'DESTINATION_ACCOUNT_NOT_FOUND';
        throw error;
      }
      if (!cuentaOrigen.activa || !cuentaDestino.activa) {
        const error = new Error('Una de las cuentas está inactiva');
        error.statusCode = 400;
        error.code = 'ACCOUNT_INACTIVE';
        throw error;
      }
      
      // Validar fondos suficientes en origen
      if (cuentaOrigen.saldo < monto) {
        const error = new Error(ERROR_MESSAGES.INSUFFICIENT_FUNDS);
        error.statusCode = 400;
        error.code = 'INSUFFICIENT_FUNDS';
        error.details = {
          saldoActual: cuentaOrigen.saldo,
          montoSolicitado: monto,
          faltante: monto - cuentaOrigen.saldo,
        };
        throw error;
      }
      
      const saldoAnteriorOrigen = cuentaOrigen.saldo;
      const saldoAnteriorDestino = cuentaDestino.saldo;
      const saldoNuevoOrigen = saldoAnteriorOrigen - monto;
      const saldoNuevoDestino = saldoAnteriorDestino + monto;
      
      // Actualizar saldos
      cuentaOrigen.saldo = saldoNuevoOrigen;
      cuentaDestino.saldo = saldoNuevoDestino;
      
      await Promise.all([
        cuentaOrigen.save({ session }),
        cuentaDestino.save({ session }),
      ]);
      
      // Crear dos movimientos: uno de salida, uno de entrada
      const [movimientoEnviado, movimientoRecibido] = await Promise.all([
        Movimiento.create([{
          tipo: MOVEMENT_TYPES.TRANSFERENCIA_ENVIADA,
          monto,
          cuentaOrigen: cuentaOrigen._id,
          cuentaDestino: cuentaDestino._id,
          descripcion: descripcion || `Transferencia a ${cuentaDestino.numeroCuenta}`,
          referencia: `${ref}_OUT`,
          saldoAnteriorOrigen,
          saldoPosteriorOrigen: saldoNuevoOrigen,
          saldoAnteriorDestino,
          saldoPosteriorDestino: saldoNuevoDestino,
        }], { session }),
        Movimiento.create([{
          tipo: MOVEMENT_TYPES.TRANSFERENCIA_RECIBIDA,
          monto,
          cuentaOrigen: cuentaOrigen._id,
          cuentaDestino: cuentaDestino._id,
          descripcion: descripcion || `Transferencia de ${cuentaOrigen.numeroCuenta}`,
          referencia: `${ref}_IN`,
          saldoAnteriorOrigen,
          saldoPosteriorOrigen: saldoNuevoOrigen,
          saldoAnteriorDestino,
          saldoPosteriorDestino: saldoNuevoDestino,
        }], { session }),
      ]);
      
      return {
        cuentaOrigen: cuentaOrigen.toPublicJSON(),
        cuentaDestino: cuentaDestino.toPublicJSON(),
        movimientoEnviado: movimientoEnviado[0].toPublicJSON(),
        movimientoRecibido: movimientoRecibido[0].toPublicJSON(),
        mensaje: SUCCESS_MESSAGES.TRANSFER_SUCCESS,
      };
    });
    
    return {
      ...resultado,
      idempotente: false,
    };
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