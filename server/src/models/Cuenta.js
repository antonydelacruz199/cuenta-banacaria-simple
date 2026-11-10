import mongoose from 'mongoose';
import { CURRENCY } from '../config/constants.js';

const cuentaSchema = new mongoose.Schema({
  numeroCuenta: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    match: /^[A-Z0-9]{10,20}$/,
  },
  titular: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  saldo: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'El saldo debe ser un entero (céntimos)',
    },
  },
  moneda: {
    type: String,
    required: true,
    default: 'PEN',
    enum: ['PEN'],
  },
  activa: {
    type: Boolean,
    default: true,
  },
  fechaCreacion: {
    type: Date,
    default: Date.now,
  },
  fechaActualizacion: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: { createdAt: 'fechaCreacion', updatedAt: 'fechaActualizacion' },
  versionKey: false,
});

// Índices
cuentaSchema.index({ titular: 1 });
cuentaSchema.index({ activa: 1 });

// Método para formatear saldo para respuesta
cuentaSchema.methods.getSaldoFormateado = function() {
  const saldoEnMoneda = this.saldo / Math.pow(10, CURRENCY.DECIMALS);
  return {
    valor: this.saldo,
    formateado: `${CURRENCY.SYMBOL} ${saldoEnMoneda.toLocaleString('es-PE', {
      minimumFractionDigits: CURRENCY.DECIMALS,
      maximumFractionDigits: CURRENCY.DECIMALS,
    })}`,
    moneda: CURRENCY.CODE,
  };
};

// Método para obtener datos públicos de la cuenta
cuentaSchema.methods.toPublicJSON = function() {
  const saldoEnMoneda = this.saldo / Math.pow(10, CURRENCY.DECIMALS);

  return {
    id: this._id,
    numeroCuenta: this.numeroCuenta,
    titular: this.titular,
    saldo: this.saldo,
    saldoFormateado: `${CURRENCY.SYMBOL} ${saldoEnMoneda.toLocaleString('es-PE', {
      minimumFractionDigits: CURRENCY.DECIMALS,
      maximumFractionDigits: CURRENCY.DECIMALS,
    })}`,
    moneda: this.moneda,
    activa: this.activa,
    fechaCreacion: this.fechaCreacion,
    fechaActualizacion: this.fechaActualizacion,
  };
};

// Método estático para buscar por ID o número de cuenta
// Acepta un session opcional para usarse dentro de transacciones MongoDB
cuentaSchema.statics.buscarPorIdONumero = async function(identificador, session = null) {
  // Primero intentar por ObjectId
  if (mongoose.Types.ObjectId.isValid(identificador)) {
    const cuenta = await this.findById(identificador).session(session);
    if (cuenta) return cuenta;
  }
  // Luego por número de cuenta
  return this.findOne({ numeroCuenta: String(identificador ?? '').toUpperCase() }).session(session);
};

const Cuenta = mongoose.model('Cuenta', cuentaSchema);

export default Cuenta;