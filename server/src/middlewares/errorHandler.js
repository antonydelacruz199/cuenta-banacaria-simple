// Middleware global de manejo de errores
// Estructura unificada de respuesta:
//   { success: false, error: <mensaje>, code: <ERROR_CODE>, details?: <objeto|array> }
// Nunca se exponen trazas internas, rutas del servidor ni información sensible.
export const errorHandler = (err, req, res, next) => {
  // Evitar respuestas HTTP duplicadas si los headers ya fueron enviados
  if (res.headersSent) {
    return next(err);
  }

  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // JSON malformado en el cuerpo de la solicitud (body-parser)
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'El cuerpo de la solicitud contiene JSON malformado',
      code: 'INVALID_JSON',
    });
  }

  // Cuerpo que excede el tamaño permitido (body-parser)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'El cuerpo de la solicitud excede el tamaño permitido',
      code: 'PAYLOAD_TOO_LARGE',
    });
  }

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
    return res.status(400).json({
      success: false,
      error: 'Error de validación',
      code: 'VALIDATION_ERROR',
      details,
    });
  }

  // Error de duplicado (índice único)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'campo';
    return res.status(409).json({
      success: false,
      error: `El valor de '${field}' ya existe`,
      code: 'DUPLICATE_KEY',
    });
  }

  // Error de ObjectId inválido
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'ID inválido',
      code: 'INVALID_ID',
    });
  }

  // Errores de negocio con código de estado definido por el servicio
  // (400 datos inválidos/fondos insuficientes, 404 cuenta inexistente,
  //  409 conflicto de referencia, 503 servicio transaccional no disponible, etc.)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  // Errores de disponibilidad de MongoDB / replica set
  if (
    err.name === 'MongoServerError' ||
    err.name === 'MongoServerSelectionError' ||
    err.name === 'MongooseServerSelectionError' ||
    err.name === 'MongoNetworkError' ||
    err.name === 'MongoTopologyClosedError' ||
    err.name === 'MongoExpiredSessionError'
  ) {
    return res.status(503).json({
      success: false,
      error: 'Servicio de base de datos no disponible',
      code: 'DATABASE_UNAVAILABLE',
    });
  }

  // Error genérico inesperado: sin trazas ni detalles internos en la respuesta
  return res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR',
  });
};

// Middleware para rutas no encontradas
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    code: 'NOT_FOUND',
    path: req.path,
  });
};

// Middleware para logging de requests
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
};

// Middleware para validar Content-Type JSON
export const validateJsonContentType = (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return res.status(415).json({
        success: false,
        error: 'Content-Type debe ser application/json',
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }
  }
  next();
};
