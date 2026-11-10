// Middleware global de manejo de errores
export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  
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
      details,
    });
  }
  
  // Error de duplicado (unique index)
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
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
  
  // Errores personalizados con statusCode
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }
  
  // Error de conexión a MongoDB
  if (err.name === 'MongoServerError' || err.name === 'MongooseServerSelectionError') {
    return res.status(503).json({
      success: false,
      error: 'Servicio de base de datos no disponible',
      code: 'DATABASE_UNAVAILABLE',
    });
  }
  
  // Error genérico
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