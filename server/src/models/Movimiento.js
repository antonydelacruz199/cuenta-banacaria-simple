import mongoose from 'mongoose';
import { CURRENCY } from '../config/constants.js';

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
    fecha: this.fecha,
    saldoAnteriorOrigen: this.saldoAnteriorOrigen,
    saldoPosteriorOrigen: this.saldoPosteriorOrigen,
    saldoAnteriorDestino: this.saldoAnteriorDestino,
    saldoPosteriorDestino: this.saldoPosteriorDestino,
  };
};

// Método estático para obtener historial paginado de una cuenta
movimientoSchema.statics.obtenerHistorialCuenta = async function(cuentaId, pagina = 1, limite = 20) {
  const skip = (pagina - 1) * limite;
  
  const [movimientos, total] = await Promise.all([
    this.find({
      $or: [
        { cuentaOrigen: cuentaId },
        { cuentaDestino: cuentaId },
      ],
    })
    .sort({ fecha: -1 })
    .skip(skip)
    .limit(limite)
    .populate('cuentaOrigen', 'numeroCuenta titular')
    .populate('cuentaDestino', 'numeroCuenta titular')
    .lean(),
    this.countDocuments({
      $or: [
        { cuentaOrigen: cuentaId },
        { cuentaDestino: cuentaId },
      ],
    }),
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
      pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
      hayMas: pagina * limite < total,
    },
  };
};

const Movimiento = mongoose.model('Movimiento', movimientoSchema);

export default Movimiento;