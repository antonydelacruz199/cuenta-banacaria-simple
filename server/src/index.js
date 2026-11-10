import 'dotenv/config';
import app from './app.js';
import { connectDB, disconnectDB } from './config/database.js';

const PORT = process.env.PORT || 3000;

let server;

const startServer = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();
    
    // Iniciar servidor HTTP
    server = app.listen(PORT, () => {
      console.log(`\n🚀 Servidor iniciado en http://localhost:${PORT}`);
      console.log(`📋 API Health: http://localhost:${PORT}/api/health`);
      console.log(`📚 Endpoints:`);
      console.log(`   GET    /api/cuenta/:id`);
      console.log(`   POST   /api/cuenta/deposito`);
      console.log(`   POST   /api/cuenta/retiro`);
      console.log(`   POST   /api/cuenta/transferencia`);
      console.log(`   GET    /api/cuenta/:id/historial`);
      console.log(`\n💡 Presiona Ctrl+C para detener\n`);
    });
    
    // Manejo de señales para cierre graceful
    const gracefulShutdown = async (signal) => {
      console.log(`\n📴 Recibida señal ${signal}, cerrando servidor...`);
      
      if (server) {
        server.close(async () => {
          console.log('✓ Servidor HTTP cerrado');
          await disconnectDB();
          process.exit(0);
        });
        
        // Forzar cierre después de 10 segundos
        setTimeout(() => {
          console.error('⚠ Cierre forzado por timeout');
          process.exit(1);
        }, 10000);
      }
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    console.error('✗ Error iniciando servidor:', error.message);
    process.exit(1);
  }
};

startServer();