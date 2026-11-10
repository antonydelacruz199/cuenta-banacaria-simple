// Constantes de la aplicación

export const CURRENCY = {
  CODE: 'PEN',
  SYMBOL: 'S/',
  DECIMALS: 2,
  NAME: 'Sol Peruano',
};

// Tipos de movimiento
export const MOVEMENT_TYPES = {
  DEPOSITO: 'deposito',
  RETIRO: 'retiro',
  TRANSFERENCIA_ENVIADA: 'transferencia_enviada',
  TRANSFERENCIA_RECIBIDA: 'transferencia_recibida',
};

// Códigos de estado HTTP
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  CONFLICT: 409,
};

// Mensajes de error estandarizados
export const ERROR_MESSAGES = {
  // Cuenta
  ACCOUNT_NOT_FOUND: 'Cuenta no encontrada',
  ACCOUNT_ALREADY_EXISTS: 'La cuenta ya existe',
  INVALID_ACCOUNT_ID: 'ID de cuenta inválido',
  
  // Monto
  INVALID_AMOUNT: 'Monto inválido',
  AMOUNT_MUST_BE_POSITIVE: 'El monto debe ser mayor a cero',
  AMOUNT_NOT_FINITE: 'El monto debe ser un número finito',
  AMOUNT_EXCEEDS_MAX: 'El monto excede el límite permitido',
  
  // Saldo
  INSUFFICIENT_FUNDS: 'Fondos insuficientes',
  NEGATIVE_BALANCE_NOT_ALLOWED: 'No se permiten saldos negativos',
  
  // Transferencia
  SAME_ACCOUNT_TRANSFER: 'No se puede transferir a la misma cuenta',
  DESTINATION_ACCOUNT_NOT_FOUND: 'Cuenta de destino no encontrada',
  TRANSFER_FAILED: 'Error en la transferencia',
  
  // Validación
  VALIDATION_ERROR: 'Error de validación',
  MISSING_REQUIRED_FIELDS: 'Faltan campos obligatorios',
  
  // Sistema
  INTERNAL_ERROR: 'Error interno del servidor',
  DATABASE_ERROR: 'Error de base de datos',
  TRANSACTIONS_NOT_SUPPORTED: 'Las transacciones no están disponibles. Configure un replica set en MongoDB.',
  OPERATION_IN_PROGRESS: 'Operación en progreso, espere...',
};

// Mensajes de éxito
export const SUCCESS_MESSAGES = {
  DEPOSIT_SUCCESS: 'Depósito realizado correctamente',
  WITHDRAWAL_SUCCESS: 'Retiro realizado correctamente',
  TRANSFER_SUCCESS: 'Transferencia realizada correctamente',
  ACCOUNT_FOUND: 'Cuenta encontrada',
  HISTORY_RETRIEVED: 'Historial recuperado correctamente',
};

// Límites
export const LIMITS = {
  MAX_AMOUNT: 999999999, // 9,999,999.99 en céntimos
  MIN_AMOUNT: 1, // 0.01 en céntimos
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

// Configuración de paginación
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};