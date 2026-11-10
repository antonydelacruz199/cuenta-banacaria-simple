import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES, PAGINATION } from '../config/constants.js';
import { 
  obtenerCuenta, 
  realizarDeposito, 
  realizarRetiro, 
  realizarTransferencia, 
  obtenerHistorial,
  formatearRespuestaCuenta 
} from '../services/cuentaService.js';

// GET /api/cuenta/:id
export const getCuenta = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cuenta = await obtenerCuenta(id);
    const respuesta = formatearRespuestaCuenta(cuenta);
    
    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: respuesta,
      mensaje: SUCCESS_MESSAGES.ACCOUNT_FOUND,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/cuenta/deposito
export const postDeposito = async (req, res, next) => {
  try {
    const { cuentaId, monto, descripcion, referencia } = req.body;
    
    const resultado = await realizarDeposito(cuentaId, monto, descripcion, referencia);
    
    const statusCode = resultado.idempotente ? HTTP_STATUS.OK : HTTP_STATUS.CREATED;
    
    res.status(statusCode).json({
      success: true,
      data: {
        cuenta: resultado.cuenta,
        movimiento: resultado.movimiento,
      },
      mensaje: resultado.mensaje,
      idempotente: resultado.idempotente,
      advertencia: resultado.advertencia,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/cuenta/retiro
export const postRetiro = async (req, res, next) => {
  try {
    const { cuentaId, monto, descripcion, referencia } = req.body;
    
    const resultado = await realizarRetiro(cuentaId, monto, descripcion, referencia);
    
    const statusCode = resultado.idempotente ? HTTP_STATUS.OK : HTTP_STATUS.CREATED;
    
    res.status(statusCode).json({
      success: true,
      data: {
        cuenta: resultado.cuenta,
        movimiento: resultado.movimiento,
      },
      mensaje: resultado.mensaje,
      idempotente: resultado.idempotente,
      advertencia: resultado.advertencia,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/cuenta/transferencia
export const postTransferencia = async (req, res, next) => {
  try {
    const { cuentaOrigenId, cuentaDestinoId, monto, descripcion, referencia } = req.body;
    
    const resultado = await realizarTransferencia(cuentaOrigenId, cuentaDestinoId, monto, descripcion, referencia);
    
    const statusCode = resultado.idempotente ? HTTP_STATUS.OK : HTTP_STATUS.CREATED;
    
    res.status(statusCode).json({
      success: true,
      data: {
        cuentaOrigen: resultado.cuentaOrigen,
        cuentaDestino: resultado.cuentaDestino,
        movimientoEnviado: resultado.movimientoEnviado,
        movimientoRecibido: resultado.movimientoRecibido,
      },
      mensaje: resultado.mensaje,
      idempotente: resultado.idempotente,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/cuenta/:id/historial
export const getHistorial = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Los validators ya convirtieron y acotaron los parámetros (.toInt(), min/máx)
    const pagina = req.query.pagina ?? PAGINATION.DEFAULT_PAGE;
    const limite = req.query.limite ?? PAGINATION.DEFAULT_LIMIT;

    const resultado = await obtenerHistorial(id, pagina, limite);

    res.status(HTTP_STATUS.OK).json({
      success: true,
      data: resultado,
      mensaje: SUCCESS_MESSAGES.HISTORY_RETRIEVED,
    });
  } catch (error) {
    next(error);
  }
};