import { Router } from 'express';
import { 
  getCuenta, 
  postDeposito, 
  postRetiro, 
  postTransferencia, 
  getHistorial 
} from '../controllers/cuentaController.js';
import {
  validateAccountId,
  validateDeposito,
  validateRetiro,
  validateTransferencia,
  validateHistorial,
} from '../validators/cuentaValidators.js';

const router = Router();

// GET /api/cuenta/:id - Obtener cuenta y saldo
router.get('/:id', validateAccountId, getCuenta);

// POST /api/cuenta/deposito - Realizar depósito
router.post('/deposito', validateDeposito, postDeposito);

// POST /api/cuenta/retiro - Realizar retiro
router.post('/retiro', validateRetiro, postRetiro);

// POST /api/cuenta/transferencia - Realizar transferencia
router.post('/transferencia', validateTransferencia, postTransferencia);

// GET /api/cuenta/:id/historial - Obtener historial de movimientos
router.get('/:id/historial', validateHistorial, getHistorial);

export default router;