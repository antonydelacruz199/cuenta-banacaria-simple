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
      code: 'VALIDATION_ERROR',
      details: errorMessages,
    });
  }
  next();
};

// ─── Validadores comunes reutilizables ─────────────────────────────────────────

// Identificador de cuenta aceptado: ObjectId de MongoDB (24 hex) o número de
// cuenta (10-20 caracteres alfanuméricos, case-insensitive; el modelo normaliza a mayúsculas)
const REGEX_OBJECTID = /^[0-9a-fA-F]{24}$/;
const REGEX_NUMERO_CUENTA = /^[A-Z0-9]{10,20}$/;

const esIdentificadorCuentaValido = (value) =>
  typeof value === 'string' &&
  (REGEX_OBJECTID.test(value) || REGEX_NUMERO_CUENTA.test(value.toUpperCase()));

// Cadena de validación para un identificador de cuenta (campo body o param).
// Rechaza valores vacíos, no-texto y malformados, sin conversiones implícitas.
const validarIdentificador = (chain, etiqueta) => chain
  .notEmpty().withMessage(`${etiqueta} es obligatorio`)
  .bail()
  .isString().withMessage(`${etiqueta} debe ser texto`)
  .bail()
  .custom((value) => {
    if (!esIdentificadorCuentaValido(value)) {
      throw new Error(`${etiqueta} inválido: debe ser un ObjectId de MongoDB o un número de cuenta de 10 a 20 caracteres alfanuméricos`);
    }
    return true;
  });

// Monto: estrictamente un number entero, finito, positivo y dentro del límite.
// Se rechaza cualquier valor que no llegue como number (sin conversión implícita):
// cadenas, booleanos, null/undefined e infinitos son inválidos.
const validarMonto = () => body('monto')
  .exists({ checkNull: true }).withMessage('El monto es obligatorio')
  .bail()
  .custom((value) => {
    if (typeof value !== 'number') {
      throw new Error('El monto debe ser un número (céntimos enteros)');
    }
    if (!Number.isFinite(value)) {
      throw new Error(ERROR_MESSAGES.AMOUNT_NOT_FINITE);
    }
    if (!Number.isInteger(value)) {
      throw new Error('El monto debe ser un entero (céntimos)');
    }
    if (value < LIMITS.MIN_AMOUNT) {
      throw new Error(ERROR_MESSAGES.AMOUNT_MUST_BE_POSITIVE);
    }
    if (value > LIMITS.MAX_AMOUNT) {
      throw new Error(ERROR_MESSAGES.AMOUNT_EXCEEDS_MAX);
    }
    return true;
  });

// Descripción opcional de la operación (texto, máx. 200)
const validarDescripcion = () => body('descripcion')
  .optional({ values: 'nullish' })
  .isString().withMessage('La descripción debe ser texto')
  .bail()
  .isLength({ max: 200 }).withMessage('La descripción no puede exceder 200 caracteres');

// Referencia opcional de idempotencia (texto). En transferencias el límite es
// inferior para reservar los 4 caracteres de los sufijos _OUT/_IN.
const validarReferencia = (maxLongitud) => body('referencia')
  .optional({ values: 'nullish' })
  .isString().withMessage('La referencia debe ser texto')
  .bail()
  .isLength({ max: maxLongitud }).withMessage(`La referencia no puede exceder ${maxLongitud} caracteres`);

// ─── Validaciones por endpoint ────────────────────────────────────────────────

// Validaciones para ID de cuenta (ObjectId o número de cuenta)
export const validateAccountId = [
  validarIdentificador(param('id'), 'El ID de la cuenta'),
  handleValidationErrors,
];

// Validaciones para depósito
export const validateDeposito = [
  validarIdentificador(body('cuentaId'), 'El ID de la cuenta'),
  validarMonto(),
  validarDescripcion(),
  validarReferencia(LIMITS.MAX_REFERENCIA),
  handleValidationErrors,
];

// Validaciones para retiro
export const validateRetiro = [
  validarIdentificador(body('cuentaId'), 'El ID de la cuenta'),
  validarMonto(),
  validarDescripcion(),
  validarReferencia(LIMITS.MAX_REFERENCIA),
  handleValidationErrors,
];

// Validaciones para transferencia
export const validateTransferencia = [
  validarIdentificador(body('cuentaOrigenId'), 'El ID de la cuenta de origen'),
  validarIdentificador(body('cuentaDestinoId'), 'El ID de la cuenta de destino'),
  validarMonto(),
  validarDescripcion(),
  validarReferencia(LIMITS.MAX_REFERENCIA_TRANSFERENCIA),
  // La regla "origen y destino no pueden ser la misma cuenta" se aplica en el servicio:
  // allí se comparan los _id resueltos (ObjectId o número de cuenta) y se responde
  // con el código SAME_ACCOUNT_TRANSFER coherente con el contrato de errores.
  handleValidationErrors,
];

// Validaciones para historial
export const validateHistorial = [
  validarIdentificador(param('id'), 'El ID de la cuenta'),
  query('pagina')
    .optional({ values: 'nullish' })
    .isInt({ min: 1 })
    .withMessage('La página debe ser un entero positivo')
    .toInt(),
  query('limite')
    .optional({ values: 'nullish' })
    .isInt({ min: 1, max: LIMITS.MAX_PAGE_SIZE })
    .withMessage(`El límite debe ser entre 1 y ${LIMITS.MAX_PAGE_SIZE}`)
    .toInt(),
  handleValidationErrors,
];
