import express from 'express';
import cors from 'cors';
import cuentaRoutes from './routes/cuentaRoutes.js';
import { errorHandler, notFoundHandler, requestLogger, validateJsonContentType } from './middlewares/errorHandler.js';

const app = express();

// Middlewares globales
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(requestLogger);
app.use(validateJsonContentType);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'cuenta-bancaria-api',
  });
});

// Rutas de la API
app.use('/api/cuenta', cuentaRoutes);

// Manejo de rutas no encontradas
app.use(notFoundHandler);

// Manejo global de errores
app.use(errorHandler);

export default app;