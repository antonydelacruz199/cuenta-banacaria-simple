// Utilidades de formateo

export const CURRENCY = {
  CODE: 'PEN',
  SYMBOL: 'S/',
  DECIMALS: 2,
};

/**
 * Formatear céntimos a moneda legible
 * @param {number} centimos - Monto en céntimos (entero)
 * @returns {string} - Monto formateado ej: "S/ 1,250.00"
 */
export function formatearMoneda(centimos) {
  if (centimos === null || centimos === undefined || isNaN(centimos)) {
    return `${CURRENCY.SYMBOL} 0.00`;
  }
  
  const valor = centimos / Math.pow(10, CURRENCY.DECIMALS);
  return `${CURRENCY.SYMBOL} ${valor.toLocaleString('es-PE', {
    minimumFractionDigits: CURRENCY.DECIMALS,
    maximumFractionDigits: CURRENCY.DECIMALS,
  })}`;
}

/**
 * Parsear moneda a céntimos
 * @param {string} valor - Monto formateado ej: "S/ 1,250.00" o "1250.00"
 * @returns {number} - Monto en céntimos (entero)
 */
export function parsearMoneda(valor) {
  if (!valor) return 0;
  
  // Eliminar símbolo de moneda y espacios
  const limpio = valor.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const numero = parseFloat(limpio);
  
  if (isNaN(numero)) return 0;
  
  return Math.round(numero * Math.pow(10, CURRENCY.DECIMALS));
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
 * @param {number} monto - Monto en céntimos
 * @returns {object} - { valido: boolean, error: string|null }
 */
export function validarMonto(monto) {
  if (monto === null || monto === undefined || isNaN(monto)) {
    return { valido: false, error: 'El monto es obligatorio' };
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
  
  if (monto > 999999999) {
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