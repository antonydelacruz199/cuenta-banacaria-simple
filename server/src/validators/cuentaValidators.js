import { body, param, query, validationResult } from 'express-validator';
import { ERROR_MESSAGES, LIMITS } from '../config/constants.js';

// Middleware para manejar errores de validación
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));
    return res.status(400).json({
      success: false,
      error: ERROR_MESSAGES.VALIDATION_ERROR,
      details: errorMessages,
    });
  }
  next();
};

// Validaciones para ID de cuenta (ObjectId o número de cuenta)
export const validateAccountId = [
  param('id')
    .notEmpty()
    .withMessage('El ID de la cuenta es obligatorio')
    .custom((value) => {
      // Aceptar ObjectId de MongoDB o número de cuenta alfanumérico
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
      const isAccountNumber = /^[A-Z0-9]{10,20}$/i.test(value);
      if (!isObjectId && !isAccountNumber) {
        throw new Error('ID de cuenta inválido');
      }
      return true;
    }),
  handleValidationErrors,
];

// Validaciones para depósito
export const validateDeposito = [
  body('cuentaId')
    .notEmpty()
    .withMessage('El ID de la cuenta es obligatorio')
    .custom((value) => {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
      const isAccountNumber = /^[A-Z0-9]{10,20}$/i.test(value);
      if (!isObjectId && !isAccountNumber) {
        throw new Error('ID de cuenta inválido');
      }
      return true;
    }),
  body('monto')
    .notEmpty()
    .withMessage('El monto es obligatorio')
    .isNumeric()
    .withMessage('El monto debe ser un número')
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw new Error(ERROR_MESSAGES.AMOUNT_NOT_FINITE);
      }
      if (num <= 0) {
        throw new Error(ERROR_MESSAGES.AMOUNT_MUST_BE_POSITIVE);
      }
      if (!Number.isInteger(num)) {
        throw new Error('El monto debe ser un entero (céntimos)');
      }
      if (num > LIMITS.MAX_AMOUNT) {
        throw new Error(ERROR_MESSAGES.AMOUNT_EXCEEDS_MAX);
      }
      return true;
    }),
  body('descripcion')
    .optional()
    .isString()
    .withMessage('La descripción debe ser texto')
    .isLength({ max: 200 })
    .withMessage('La descripción no puede exceder 200 caracteres'),
  body('referencia')
    .optional()
    .isString()
    .withMessage('La referencia debe ser texto')
    .isLength({ max: 50 })
    .withMessage('La referencia no puede exceder 50 caracteres'),
  handleValidationErrors,
];

// Validaciones para retiro
export const validateRetiro = [
  body('cuentaId')
    .notEmpty()
    .withMessage('El ID de la cuenta es obligatorio')
    .custom((value) => {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
      const isAccountNumber = /^[A-Z0-9]{10,20}$/i.test(value);
      if (!isObjectId && !isAccountNumber) {
        throw new Error('ID de cuenta inválido');
      }
      return true;
    }),
  body('monto')
    .notEmpty()
    .withMessage('El monto es obligatorio')
    .isNumeric()
    .withMessage('El monto debe ser un número')
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw new Error(ERROR_MESSAGES.AMOUNT_NOT_FINITE);
      }
      if (num <= 0) {
        throw new Error(ERROR_MESSAGES.AMOUNT_MUST_BE_POSITIVE);
      }
      if (!Number.isInteger(num)) {
        throw new Error('El monto debe ser un entero (céntimos)');
      }
      if (num > LIMITS.MAX_AMOUNT) {
        throw new Error(ERROR_MESSAGES.AMOUNT_EXCEEDS_MAX);
      }
      return true;
    }),
  body('descripcion')
    .optional()
    .isString()
    .withMessage('La descripción debe ser texto')
    .isLength({ max: 200 })
    .withMessage('La descripción no puede exceder 200 caracteres'),
  body('referencia')
    .optional()
    .isString()
    .withMessage('La referencia debe ser texto')
    .isLength({ max: 50 })
    .withMessage('La referencia no puede exceder 50 caracteres'),
  handleValidationErrors,
];

// Validaciones para transferencia
export const validateTransferencia = [
  body('cuentaOrigenId')
    .notEmpty()
    .withMessage('El ID de la cuenta de origen es obligatorio')
    .custom((value) => {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
      const isAccountNumber = /^[A-Z0-9]{10,20}$/i.test(value);
      if (!isObjectId && !isAccountNumber) {
        throw new Error('ID de cuenta de origen inválido');
      }
      return true;
    }),
  body('cuentaDestinoId')
    .notEmpty()
    .withMessage('El ID de la cuenta de destino es obligatorio')
    .custom((value) => {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
      const isAccountNumber = /^[A-Z0-9]{10,20}$/i.test(value);
      if (!isObjectId && !isAccountNumber) {
        throw new Error('ID de cuenta de destino inválido');
      }
      return true;
    }),
  body('monto')
    .notEmpty()
    .withMessage('El monto es obligatorio')
    .isNumeric()
    .withMessage('El monto debe ser un número')
    .custom((value) => {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw new Error(ERROR_MESSAGES.AMOUNT_NOT_FINITE);
      }
      if (num <= 0) {
        throw new Error(ERROR_MESSAGES.AMOUNT_MUST_BE_POSITIVE);
      }
      if (!Number.isInteger(num)) {
        throw new Error('El monto debe ser un entero (céntimos)');
      }
      if (num > LIMITS.MAX_AMOUNT) {
        throw new Error(ERROR_MESSAGES.AMOUNT_EXCEEDS_MAX);
      }
      return true;
    }),
  body('descripcion')
    .optional()
    .isString()
    .withMessage('La descripción debe ser texto')
    .isLength({ max: 200 })
    .withMessage('La descripción no puede exceder 200 caracteres'),
  body('referencia')
    .optional()
    .isString()
    .withMessage('La referencia debe ser texto')
    .isLength({ max: 46 })
    .withMessage('La referencia no puede exceder 46 caracteres (se reservan 4 para los sufijos _OUT/_IN de transferencia)'),
  // La regla "origen y destino no pueden ser la misma cuenta" se aplica en el servicio:
  // allí se comparan los _id resueltos (ObjectId o número de cuenta) y se responde
  // con el código SAME_ACCOUNT_TRANSFER coherente con el contrato de errores.
  handleValidationErrors,
];

// Validaciones para historial
export const validateHistorial = [
  param('id')
    .notEmpty()
    .withMessage('El ID de la cuenta es obligatorio')
    .custom((value) => {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(value);
      const isAccountNumber = /^[A-Z0-9]{10,20}$/i.test(value);
      if (!isObjectId && !isAccountNumber) {
        throw new Error('ID de cuenta inválido');
      }
      return true;
    }),
  query('pagina')
    .optional()
    .isInt({ min: 1 })
    .withMessage('La página debe ser un entero positivo')
    .toInt(),
  query('limite')
    .optional()
    .isInt({ min: 1, max: LIMITS.MAX_PAGE_SIZE })
    .withMessage(`El límite debe ser entre 1 y ${LIMITS.MAX_PAGE_SIZE}`)
    .toInt(),
  handleValidationErrors,
];