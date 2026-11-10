import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { connectDB, disconnectDB, areTransactionsSupported } from '../src/config/database.js';
import Cuenta from '../src/models/Cuenta.js';
import Movimiento from '../src/models/Movimiento.js';
import { CURRENCY, LIMITS } from '../src/config/constants.js';

const cuentasDemo = [
  {
    numeroCuenta: 'PE0010000001',
    titular: 'María González López',
    saldo: 500000, // S/ 5,000.00
    moneda: CURRENCY.CODE,
    activa: true,
  },
  {
    numeroCuenta: 'PE0010000002',
    titular: 'Carlos Rodríguez Pérez',
    saldo: 1250000, // S/ 12,500.00
    moneda: CURRENCY.CODE,
    activa: true,
  },
  {
    numeroCuenta: 'PE0010000003',
    titular: 'Ana Martínez Silva',
    saldo: 75000, // S/ 750.00
    moneda: CURRENCY.CODE,
    activa: true,
  },
  {
    numeroCuenta: 'PE0010000004',
    titular: 'Juan Pedro Fernández',
    saldo: 2500000, // S/ 25,000.00
    moneda: CURRENCY.CODE,
    activa: true,
  },
  {
    numeroCuenta: 'PE0010000005',
    titular: 'Laura Torres Vargas',
    saldo: 0, // S/ 0.00
    moneda: CURRENCY.CODE,
    activa: true,
  },
];

const formatearMoneda = (centimos) => {
  const valor = centimos / Math.pow(10, CURRENCY.DECIMALS);
  return `${CURRENCY.SYMBOL} ${valor.toLocaleString('es-PE', {
    minimumFractionDigits: CURRENCY.DECIMALS,
    maximumFractionDigits: CURRENCY.DECIMALS,
  })}`;
};

const seed = async () => {
  console.log('🌱 Iniciando seed de datos de prueba...\n');
  
  try {
    await connectDB();
    
    const transactionsSupported = await areTransactionsSupported();
    if (!transactionsSupported) {
      console.warn('⚠ Replica set no detectado - Las transferencias fallarán');
      console.warn('  Ejecuta en mongosh: rs.initiate()\n');
    }
    
    // Verificar si ya existen cuentas
    const existingCount = await Cuenta.countDocuments();
    if (existingCount > 0) {
      console.log(`📊 Base de datos ya tiene ${existingCount} cuenta(s)`);
      console.log('   Para re-seed, elimina la base de datos primero o usa --force\n');
      
      // Mostrar cuentas existentes
      const cuentas = await Cuenta.find().sort({ numeroCuenta: 1 });
      console.log('   Cuentas actuales:');
      cuentas.forEach(c => {
        console.log(`     - ${c.numeroCuenta} | ${c.titular} | ${formatearMoneda(c.saldo)}`);
      });
      
      await disconnectDB();
      return;
    }
    
    // Crear cuentas
    console.log('📝 Creando cuentas de demostración...');
    const cuentasCreadas = await Cuenta.insertMany(cuentasDemo);
    
    console.log(`✅ ${cuentasCreadas.length} cuentas creadas:\n`);
    cuentasCreadas.forEach(c => {
      console.log(`   - ${c.numeroCuenta} | ${c.titular} | ${formatearMoneda(c.saldo)}`);
    });
    
    // Crear algunos movimientos de ejemplo
    console.log('\n📝 Creando historial de movimientos de ejemplo...');
    
    const cuenta1 = cuentasCreadas.find(c => c.numeroCuenta === 'PE0010000001');
    const cuenta2 = cuentasCreadas.find(c => c.numeroCuenta === 'PE0010000002');
    const cuenta3 = cuentasCreadas.find(c => c.numeroCuenta === 'PE0010000003');
    
    const movimientosEjemplo = [
      // Depósitos iniciales
      {
        tipo: 'deposito',
        monto: 500000,
        cuentaDestino: cuenta1._id,
        descripcion: 'Depósito inicial',
        referencia: 'SEED_DEP_001',
        saldoAnteriorDestino: 0,
        saldoPosteriorDestino: 500000,
      },
      {
        tipo: 'deposito',
        monto: 1250000,
        cuentaDestino: cuenta2._id,
        descripcion: 'Depósito inicial',
        referencia: 'SEED_DEP_002',
        saldoAnteriorDestino: 0,
        saldoPosteriorDestino: 1250000,
      },
      {
        tipo: 'deposito',
        monto: 75000,
        cuentaDestino: cuenta3._id,
        descripcion: 'Depósito inicial',
        referencia: 'SEED_DEP_003',
        saldoAnteriorDestino: 0,
        saldoPosteriorDestino: 75000,
      },
      // Algunos retiros
      {
        tipo: 'retiro',
        monto: 50000,
        cuentaOrigen: cuenta1._id,
        descripcion: 'Retiro en cajero',
        referencia: 'SEED_RET_001',
        saldoAnteriorOrigen: 500000,
        saldoPosteriorOrigen: 450000,
      },
      // Transferencia de ejemplo
      {
        tipo: 'transferencia_enviada',
        monto: 100000,
        cuentaOrigen: cuenta2._id,
        cuentaDestino: cuenta3._id,
        descripcion: 'Transferencia a Ana Martínez',
        referencia: 'SEED_TRF_001_OUT',
        saldoAnteriorOrigen: 1250000,
        saldoPosteriorOrigen: 1150000,
        saldoAnteriorDestino: 75000,
        saldoPosteriorDestino: 175000,
      },
      {
        tipo: 'transferencia_recibida',
        monto: 100000,
        cuentaOrigen: cuenta2._id,
        cuentaDestino: cuenta3._id,
        descripcion: 'Transferencia de Carlos Rodríguez',
        referencia: 'SEED_TRF_001_IN',
        saldoAnteriorOrigen: 1250000,
        saldoPosteriorOrigen: 1150000,
        saldoAnteriorDestino: 75000,
        saldoPosteriorDestino: 175000,
      },
    ];
    
    await Movimiento.insertMany(movimientosEjemplo);
    console.log(`✅ ${movimientosEjemplo.length} movimientos de ejemplo creados\n`);
    
    // Verificar saldos finales
    console.log('📊 Saldos finales después del seed:');
    const cuentasFinales = await Cuenta.find().sort({ numeroCuenta: 1 });
    cuentasFinales.forEach(c => {
      console.log(`   - ${c.numeroCuenta} | ${c.titular} | ${formatearMoneda(c.saldo)}`);
    });
    
    // Verificar consistencia
    const totalSaldos = cuentasFinales.reduce((sum, c) => sum + c.saldo, 0);
    console.log(`\n💰 Total en el sistema: ${formatearMoneda(totalSaldos)}`);
    
    console.log('\n✨ Seed completado exitosamente');
    console.log('\n📋 Cuentas de prueba disponibles:');
    console.log('   PE0010000001 - María González López - S/ 5,000.00');
    console.log('   PE0010000002 - Carlos Rodríguez Pérez - S/ 12,500.00');
    console.log('   PE0010000003 - Ana Martínez Silva - S/ 750.00');
    console.log('   PE0010000004 - Juan Pedro Fernández - S/ 25,000.00');
    console.log('   PE0010000005 - Laura Torres Vargas - S/ 0.00');

  } catch (error) {
    console.error('\n✗ Error en seed:', error.message);
    if (error.code === 11000) {
      console.error('  Las cuentas ya existen. Elimina la BD o usa --force');
    }
    throw error;
  } finally {
    await disconnectDB();
  }
};

// Ejecutar si se llama directamente.
// pathToFileURL normaliza la ruta al formato file:// URL (necesario en Windows,
// donde process.argv[1] usa barras invertidas y comparar contra import.meta.url falla)
const esEjecucionDirecta = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecucionDirecta) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seed };