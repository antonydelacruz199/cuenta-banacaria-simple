// Utilidades de formateo

export const CURRENCY = {
  CODE: 'PEN',
  SYMBOL: 'S/',
  DECIMALS: 2,
};

// Límite de monto en céntimos (9,999,999.99 soles) — sincronizado con LIMITS.MAX_AMOUNT del backend
const MAX_MONTO_CENTIMOS = 999999999;

/**
 * Formatear céntimos a moneda legible
 * @param {number} centimos - Monto en céntimos (entero)
 * @returns {string} - Monto formateado ej: "S/ 1,250.00"
 */
export function formatearMoneda(centimos) {
  if (centimos === null || centimos === undefined || !Number.isFinite(Number(centimos))) {
    return `${CURRENCY.SYMBOL} 0.00`;
  }

  // Aritmética entera pura: evita errores de precisión de punto flotante
  const entero = Math.trunc(Number(centimos));
  const negativo = entero < 0;
  const abs = Math.abs(entero);
  const soles = Math.trunc(abs / 100);
  const centavos = abs % 100;
  const solesFormateados = soles.toLocaleString('es-PE', { maximumFractionDigits: 0 });

  return `${CURRENCY.SYMBOL} ${negativo ? '-' : ''}${solesFormateados}.${String(centavos).padStart(2, '0')}`;
}

// Convierte parte entera y decimales (como strings de dígitos) a céntimos sin usar punto flotante
const aCentimos = (enteros, decimales) => {
  const dec = decimales ? decimales.padEnd(2, '0') : '00';
  const digitos = `${enteros}${dec}`;
  if (digitos.length > 15) return null; // fuera del rango seguro de enteros
  const valor = Number(digitos);
  return Number.isSafeInteger(valor) ? valor : null;
};

// Valida agrupación de millares: primer grupo 1-3 dígitos sin cero inicial, resto exactamente 3 dígitos
const interpretarMillares = (parteEntera, separador) => {
  const grupos = parteEntera.split(separador);
  if (grupos.length < 2) return null;
  if (!/^[1-9]\d{0,2}$/.test(grupos[0])) return null;
  for (let i = 1; i < grupos.length; i++) {
    if (!/^\d{3}$/.test(grupos[i])) return null;
  }
  return grupos.join('');
};

/**
 * Parsear moneda a céntimos
 * @param {string} valor - Monto ingresado. Formatos aceptados (inequívocos):
 *   - Entero: "100" → 10000
 *   - Decimal con punto o coma: "100.50", "100,50" → 10050
 *   - Millares + decimales: "1,250.00" o "1.250,00" → 125000
 *   - Millares sin decimales: "1,250", "1.250.300" → 125000, 125030000
 * @returns {number|null} - Monto en céntimos (entero) o null si el formato es ambiguo o incorrecto
 */
export function parsearMoneda(valor) {
  if (typeof valor !== 'string') return null;

  let s = valor.trim();
  if (!s) return null;

  // Quitar símbolo de moneda inicial (ej: "S/ 1,250.00")
  s = s.replace(/^S\/\s*/i, '').trim();
  if (!s) return null;

  // Solo dígitos, punto y coma permitidos; cualquier otro carácter invalida la entrada
  if (!/^[0-9.,]+$/.test(s)) return null;

  // 1) Entero puro
  if (/^\d+$/.test(s)) return aCentimos(s, null);

  // 2) Decimal con un separador (1 o 2 dígitos decimales)
  const mDec = s.match(/^(\d+)([.,])(\d{1,2})$/);
  if (mDec) return aCentimos(mDec[1], mDec[3]);

  // 3) Millares + decimales: dos separadores distintos, el último es el decimal (formato inequívoco)
  const mMixto = s.match(/^(\d{1,3})([.,]\d{3})+([.,])(\d{1,2})$/);
  if (mMixto) {
    const decimales = mMixto[4];
    const sepDecimal = s[s.length - decimales.length - 1];
    const parteEntera = s.slice(0, s.length - decimales.length - 1);
    const sepMillar = parteEntera.replace(/\d/g, '')[0];
    if (sepMillar !== sepDecimal) {
      const enteros = interpretarMillares(parteEntera, sepMillar);
      if (enteros) return aCentimos(enteros, decimales);
    }
    return null;
  }

  // 4) Millares sin decimales: un único separador, grupos de 3 dígitos
  const seps = s.replace(/\d/g, '');
  if (seps.length >= 1 && /^[1-9]/.test(s)) {
    const sep = seps[0];
    if (seps.split('').every(sp => sp === sep)) {
      const enteros = interpretarMillares(s, sep);
      if (enteros) return aCentimos(enteros, null);
    }
  }

  // Formato ambiguo o incorrecto: no se interpreta arbitrariamente
  return null;
}

/**
 * Formatear fecha para mostrar
 * @param {string|Date} fecha - Fecha ISO o Date
 * @param {object} opciones - Opciones de Intl.DateTimeFormat
 * @returns {string} - Fecha formateada
 */
export function formatearFecha(fecha, opciones = {}) {
  if (!fecha) return '';

  const date = typeof fecha === 'string' ? new Date(fecha) : fecha;

  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opciones,
  });
}

/**
 * Formatear fecha relativa (hace X tiempo)
 * @param {string|Date} fecha - Fecha ISO o Date
 * @returns {string} - Tiempo relativo
 */
export function formatearFechaRelativa(fecha) {
  if (!fecha) return '';

  const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
  const ahora = new Date();
  const diffMs = ahora - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;

  return formatearFecha(date);
}

/**
 * Obtener clase CSS para badge según tipo de movimiento
 * @param {string} tipo - Tipo de movimiento
 * @returns {string} - Clases Tailwind
 */
export function getBadgeClass(tipo) {
  const clases = {
    deposito: 'badge-success',
    retiro: 'badge-danger',
    transferencia_enviada: 'badge-warning',
    transferencia_recibida: 'badge-info',
  };
  return clases[tipo] || 'badge-primary';
}

/**
 * Obtener etiqueta legible para tipo de movimiento
 * @param {string} tipo - Tipo de movimiento
 * @returns {string} - Etiqueta
 */
export function getTipoLabel(tipo) {
  const labels = {
    deposito: 'Depósito',
    retiro: 'Retiro',
    transferencia_enviada: 'Transferencia enviada',
    transferencia_recibida: 'Transferencia recibida',
  };
  return labels[tipo] || tipo;
}

/**
 * Generar referencia única para idempotencia
 * @param {string} prefijo - Prefijo para la referencia
 * @returns {string} - Referencia única
 */
export function generarReferencia(prefijo = 'OP') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefijo}_${timestamp}_${random}`.toUpperCase();
}

/**
 * Validar monto en céntimos
 * @param {number|null} monto - Monto en céntimos (entero) o null si el formato es inválido
 * @returns {object} - { valido: boolean, error: string|null }
 */
export function validarMonto(monto) {
  if (monto === null || monto === undefined || (typeof monto === 'number' && Number.isNaN(monto))) {
    return { valido: false, error: 'Monto inválido' };
  }

  if (!Number.isFinite(monto)) {
    return { valido: false, error: 'El monto debe ser un número finito' };
  }

  if (!Number.isInteger(monto)) {
    return { valido: false, error: 'El monto debe ser un valor entero (céntimos)' };
  }

  if (monto <= 0) {
    return { valido: false, error: 'El monto debe ser mayor a cero' };
  }

  if (monto > MAX_MONTO_CENTIMOS) {
    return { valido: false, error: 'El monto excede el límite permitido' };
  }

  return { valido: true, error: null };
}

/**
 * Truncar texto con elipsis
 * @param {string} texto - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} - Texto truncado
 */
export function truncar(texto, maxLength = 30) {
  if (!texto) return '';
  if (texto.length <= maxLength) return texto;
  return texto.substring(0, maxLength - 3) + '...';
}
