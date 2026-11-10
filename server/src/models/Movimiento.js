import mongoose from 'mongoose';
import { CURRENCY, MOVEMENT_TYPES, PAGINATION } from '../config/constants.js';

const movimientoSchema = new mongoose.Schema({
  tipo: {
    type: String,
    required: true,
    enum: [
      'deposito',
      'retiro',
      'transferencia_enviada',
      'transferencia_recibida',
    ],
  },
  monto: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'El monto debe ser un entero (céntimos)',
    },
  },
  cuentaOrigen: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cuenta',
    required: function() {
      return this.tipo !== 'deposito';
    },
  },
  cuentaDestino: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cuenta',
    required: function() {
      return this.tipo !== 'retiro';
    },
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: 200,
  },
  referencia: {
    type: String,
    trim: true,
    maxlength: 50,
    // Para idempotencia: identificador único de la operación
  },
  fecha: {
    type: Date,
    default: Date.now,
  },
  // Para auditoría: saldo antes y después de la operación
  saldoAnteriorOrigen: {
    type: Number,
    validate: {
      validator: Number.isInteger,
      message: 'El saldo anterior debe ser un entero',
    },
  },
  saldoPosteriorOrigen: {
    type: Number,
    validate: {
      validator: Number.isInteger,
      message: 'El saldo posterior debe ser un entero',
    },
  },
  saldoAnteriorDestino: {
    type: Number,
    validate: {
      validator: Number.isInteger,
      message: 'El saldo anterior debe ser un entero',
    },
  },
  saldoPosteriorDestino: {
    type: Number,
    validate: {
      validator: Number.isInteger,
      message: 'El saldo posterior debe ser un entero',
    },
  },
}, {
  timestamps: true,
  versionKey: false,
});

// Índices para consultas frecuentes
movimientoSchema.index({ cuentaOrigen: 1, fecha: -1 });
movimientoSchema.index({ cuentaDestino: 1, fecha: -1 });
movimientoSchema.index({ fecha: -1 });
movimientoSchema.index({ tipo: 1 });
movimientoSchema.index({ referencia: 1 }, { unique: true, sparse: true });

// Método para formatear movimiento para respuesta
movimientoSchema.methods.toPublicJSON = function() {
  const montoEnMoneda = this.monto / Math.pow(10, CURRENCY.DECIMALS);

  return {
    id: this._id,
    tipo: this.tipo,
    monto: this.monto,
    montoFormateado: `${CURRENCY.SYMBOL} ${montoEnMoneda.toLocaleString('es-PE', {
      minimumFractionDigits: CURRENCY.DECIMALS,
      maximumFractionDigits: CURRENCY.DECIMALS,
    })}`,
    cuentaOrigen: this.cuentaOrigen,
    cuentaDestino: this.cuentaDestino,
    descripcion: this.descripcion,
    referencia: this.referencia,
    fecha: this.fecha,
    saldoAnteriorOrigen: this.saldoAnteriorOrigen,
    saldoPosteriorOrigen: this.saldoPosteriorOrigen,
    saldoAnteriorDestino: this.saldoAnteriorDestino,
    saldoPosteriorDestino: this.saldoPosteriorDestino,
  };
};

// Método estático para obtener historial paginado de una cuenta
movimientoSchema.statics.obtenerHistorialCuenta = async function(cuentaId, pagina = PAGINATION.DEFAULT_PAGE, limite = PAGINATION.DEFAULT_LIMIT) {
  // Normalización defensiva: pagina y limite siempre enteros dentro de rango válido
  const paginaNormalizada = Math.max(1, Math.trunc(Number(pagina) || PAGINATION.DEFAULT_PAGE));
  const limiteNormalizado = Math.min(
    Math.max(1, Math.trunc(Number(limite) || PAGINATION.DEFAULT_LIMIT)),
    PAGINATION.MAX_LIMIT
  );
  const skip = (paginaNormalizada - 1) * limiteNormalizado;

  // Cada transferencia genera dos movimientos: uno con tipo transferencia_enviada
  // (perteneciente a la cuenta origen) y otro transferencia_recibida (perteneciente
  // a la cuenta destino). Filtrar cada tipo por SU cuenta evita que la misma
  // transferencia aparezca duplicada en el historial de una sola cuenta.
  const filtro = {
    $or: [
      { tipo: MOVEMENT_TYPES.DEPOSITO, cuentaDestino: cuentaId },
      { tipo: MOVEMENT_TYPES.RETIRO, cuentaOrigen: cuentaId },
      { tipo: MOVEMENT_TYPES.TRANSFERENCIA_ENVIADA, cuentaOrigen: cuentaId },
      { tipo: MOVEMENT_TYPES.TRANSFERENCIA_RECIBIDA, cuentaDestino: cuentaId },
    ],
  };

  const [movimientos, total] = await Promise.all([
    this.find(filtro)
      .sort({ fecha: -1, _id: -1 }) // _id como desempate: orden estable cuando varios movimientos comparten fecha
      .skip(skip)
      .limit(limiteNormalizado)
      .populate('cuentaOrigen', 'numeroCuenta titular')
      .populate('cuentaDestino', 'numeroCuenta titular')
      .lean(),
    this.countDocuments(filtro),
  ]);

  return {
    movimientos: movimientos.map(m => ({
      ...m,
      cuentaOrigen: m.cuentaOrigen ? {
        numeroCuenta: m.cuentaOrigen.numeroCuenta,
        titular: m.cuentaOrigen.titular,
      } : null,
      cuentaDestino: m.cuentaDestino ? {
        numeroCuenta: m.cuentaDestino.numeroCuenta,
        titular: m.cuentaDestino.titular,
      } : null,
    })),
    paginacion: {
      pagina: paginaNormalizada,
      limite: limiteNormalizado,
      total,
      totalPaginas: Math.ceil(total / limiteNormalizado),
      hayMas: paginaNormalizada * limiteNormalizado < total,
    },
  };
};

const Movimiento = mongoose.model('Movimiento', movimientoSchema);

export default Movimiento;