# Sistema de Gestión de Cuenta Bancaria Simplificada

Aplicación Full-Stack para la gestión de cuentas bancarias desarrollada con **Node.js**, **Express**, **MongoDB**, **React**, **Vite** y **Tailwind CSS**.

## 📋 Descripción

Este sistema permite realizar operaciones bancarias básicas:
- ✅ Consulta de saldo y datos de la cuenta
- ✅ Depósito de fondos
- ✅ Retiro de fondos (validando saldo suficiente)
- ✅ Transferencias entre cuentas (atómicas con transacciones MongoDB)
- ✅ Historial de movimientos con paginación

## 🛠 Tecnologías

### Backend
- **Node.js** + **Express.js**
- **MongoDB** local con **Mongoose**
- **JavaScript ES6+** (Módulos ES)
- Validaciones con **express-validator**
- Tests con **Jest** + **Supertest**

### Frontend
- **React 18** + **Vite**
- **Tailwind CSS** para estilos
- **Hooks** personalizados (`useState`, `useEffect`)
- Componentes reutilizables con Props

## 📁 Estructura del Proyecto

```
cuenta-bancaria/
├── server/
│   ├── src/
│   │   ├── config/         # Configuración DB, constantes
│   │   ├── controllers/    # Controladores HTTP
│   │   ├── middlewares/    # Middlewares (errores, logging)
│   │   ├── models/         # Modelos Mongoose (Cuenta, Movimiento)
│   │   ├── routes/         # Rutas Express
│   │   ├── services/       # Lógica de negocio
│   │   ├── validators/     # Validaciones express-validator
│   │   ├── app.js          # App Express
│   │   └── index.js        # Entry point
│   ├── scripts/
│   │   └── seed.js         # Script de datos de prueba
│   ├── tests/
│   │   ├── setup.js        # Configuración Jest
│   │   └── cuenta.test.js  # Tests de integración
│   ├── .env.example        # Variables de entorno ejemplo
│   └── package.json
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/     # Componentes React reutilizables
│   │   ├── hooks/          # Custom hooks
│   │   ├── pages/          # Páginas
│   │   ├── services/       # Cliente API
│   │   ├── utils/          # Utilidades (formateo, validación)
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── .gitignore
└── README.md
```

## 🚀 Requisitos Previos

- **Node.js** 18+ y **npm**
- **MongoDB** 6.0+ (local)
- **Git** (opcional)

### Instalación de MongoDB Local

#### Windows
```bash
# Descargar desde: https://www.mongodb.com/try/download/community
# O con Chocolatey:
choco install mongodb
```

#### macOS
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb/brew/mongodb-community
```

#### Linux (Ubuntu/Debian)
```bash
# Seguir guía oficial: https://www.mongodb.com/docs/manual/installation/
```

### ⚠️ Configuración de Replica Set (OBLIGATORIO para transferencias)

**Las transferencias atómicas requieren un replica set en MongoDB.**

1. Crear directorio de datos:
```bash
mkdir -p data/db
```

2. Iniciar MongoDB con replica set:
```bash
mongod --replSet rs0 --dbpath ./data/db --port 27017
```

3. En otra terminal, inicializar el replica set:
```bash
mongosh
# En el shell de mongosh:
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
})
```

4. Verificar estado:
```bash
rs.status()
```

> **Nota:** Si no configuras el replica set, las transferencias fallarán con error `TRANSACTIONS_NOT_SUPPORTED`. Las demás operaciones (depósito, retiro, consulta) funcionarán normalmente.

## ⚙️ Instalación

### 1. Clonar y entrar al proyecto
```bash
cd cuenta-bancaria-simple
```

### 2. Configurar Backend
```bash
cd server
cp .env.example .env
# Editar .env si es necesario (MONGODB_URI, PORT, etc.)
npm install
```

### 3. Configurar Frontend
```bash
cd ../client
npm install
```

## 🏃 Ejecución

### Terminal 1 - Backend
```bash
cd server
npm run dev
# Servidor en http://localhost:3000
```

### Terminal 2 - Frontend
```bash
cd client
npm run dev
# Aplicación en http://localhost:5173
```

### Terminal 3 - Seed (datos de prueba)
```bash
cd server
npm run seed
# Crea 5 cuentas de prueba con saldos y movimientos
```

## 🌱 Cuentas de Prueba (Seed)

El script `seed.js` crea 5 cuentas:

| N° Cuenta | Titular | Saldo Inicial |
|-----------|---------|---------------|
| PE0010000001 | María González López | S/ 5,000.00 |
| PE0010000002 | Carlos Rodríguez Pérez | S/ 12,500.00 |
| PE0010000003 | Ana Martínez Silva | S/ 750.00 |
| PE0010000004 | Juan Pedro Fernández | S/ 25,000.00 |
| PE0010000005 | Laura Torres Vargas | S/ 0.00 |

También crea movimientos de ejemplo (depósitos, retiros, transferencias).

## 📚 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/cuenta/:id` | Obtener cuenta y saldo |
| POST | `/api/cuenta/deposito` | Realizar depósito |
| POST | `/api/cuenta/retiro` | Realizar retiro |
| POST | `/api/cuenta/transferencia` | Realizar transferencia |
| GET | `/api/cuenta/:id/historial` | Historial paginado |

### Ejemplos de Uso

#### Consultar cuenta
```bash
curl http://localhost:3000/api/cuenta/PE0010000001
```

#### Depósito
```bash
curl -X POST http://localhost:3000/api/cuenta/deposito \
  -H "Content-Type: application/json" \
  -d '{"cuentaId": "PE0010000001", "monto": 100000, "descripcion": "Depósito de prueba"}'
```

#### Retiro
```bash
curl -X POST http://localhost:3000/api/cuenta/retiro \
  -H "Content-Type: application/json" \
  -d '{"cuentaId": "PE0010000001", "monto": 50000}'
```

#### Transferencia
```bash
curl -X POST http://localhost:3000/api/cuenta/transferencia \
  -H "Content-Type: application/json" \
  -d '{"cuentaOrigenId": "PE0010000002", "cuentaDestinoId": "PE0010000003", "monto": 300000}'
```

#### Historial
```bash
curl "http://localhost:3000/api/cuenta/PE0010000001/historial?pagina=1&limite=10"
```

### Formato de Respuesta Exitosa
```json
{
  "success": true,
  "data": { ... },
  "mensaje": "Operación realizada correctamente",
  "idempotente": false
}
```

### Formato de Error
```json
{
  "success": false,
  "error": "Descripción del error",
  "code": "CODIGO_ERROR",
  "details": { ... }
}
```

### Códigos de Estado HTTP
- `200` - Operación correcta (incluye idempotentes)
- `201` - Recurso creado
- `400` - Datos inválidos / Saldo insuficiente
- `404` - Cuenta no encontrada
- `409` - Conflicto (duplicado)
- `500` - Error interno
- `503` - Base de datos no disponible

## 🧪 Tests

### Backend
```bash
cd server
npm test
# Con coverage:
npm test -- --coverage
```

Los tests cubren:
1. ✅ Consulta de cuenta existente
2. ✅ Consulta de cuenta inexistente
3. ✅ Depósito correcto
4. ✅ Depósito con monto inválido
5. ✅ Retiro correcto
6. ✅ Retiro con fondos insuficientes
7. ✅ Transferencia correcta
8. ✅ Transferencia a cuenta inexistente
9. ✅ Transferencia a la misma cuenta
10. ✅ Transferencia con fondos insuficientes
11. ✅ Atomicidad de transferencia (rollback en fallo)
12. ✅ Operaciones concurrentes
13. ✅ Persistencia del historial
14. ✅ Consistencia de saldos (suma total invariante)

> **Nota:** Tests de transferencia requieren replica set configurado.

### Frontend
```bash
cd client
npm run build
# Verifica compilación de producción
```

## 💰 Moneda y Precisión

- **Moneda:** PEN (Sol Peruano) - S/
- **Almacenamiento:** Enteros en **céntimos** (evita errores de punto flotante)
- **Ejemplo:** S/ 1,250.00 → 125000 céntimos
- **Formateo:** `S/ 1,250.00` (locale `es-PE`)

## 🔒 Reglas de Negocio Implementadas

- ✅ Valores monetarios en céntimos (enteros)
- ✅ Validación de montos positivos, finitos, enteros
- ✅ Prevención de saldos negativos
- ✅ Transferencias atómicas con transacciones MongoDB
- ✅ Idempotencia mediante referencias únicas
- ✅ Validación frontend + backend
- ✅ No confianza en estado del cliente
- ✅ Deshabilitar botones durante operaciones
- ✅ Manejo de errores consistente

## 🎨 Interfaz de Usuario

- **Responsive:** Mobile-first, breakpoints sm/md/lg/xl
- **Accesible:** Contraste, focus visible, ARIA labels
- **Estados:** Loading, error, success, empty
- **Feedback visual:** Badges por tipo de movimiento, animaciones suaves
- **Tailwind CSS:** Solo clases utilitarias, sin CSS personalizado

## 📦 Scripts Disponibles

### Server
```bash
npm start        # Producción
npm run dev      # Desarrollo con watch
npm run seed     # Poblar BD con datos de prueba
npm test         # Tests Jest
```

### Client
```bash
npm run dev      # Servidor desarrollo Vite
npm run build    # Build producción
npm run preview  # Preview build
npm run lint     # ESLint
```

## 🐛 Problemas Frecuentes

| Problema | Solución |
|----------|----------|
| `ECONNREFUSED` MongoDB | Verificar que `mongod` esté corriendo en puerto 27017 |
| `TRANSACTIONS_NOT_SUPPORTED` | Configurar replica set (ver sección arriba) |
| Puerto 3000/5173 en uso | Cambiar `PORT` en `.env` o matar proceso |
| `MongooseServerSelectionError` | Verificar `MONGODB_URI` en `.env` |
| CORS error en frontend | Verificar `CLIENT_URL` en `.env` del server |
| Tests fallan por timeout | Aumentar `testTimeout` en `jest.config.js` |

## ⚠️ Limitaciones (Simulación Académica)

- **Sin autenticación/autorización** - Todas las cuentas accesibles
- **Sin encriptación** - Datos en texto plano
- **Sin auditoría completa** - Solo movimientos básicos
- **Sin límites regulatorios** - KYC, AML, etc.
- **Sin concurrencia real** - Tests básicos de race conditions
- **MongoDB local** - Sin backup, replicación geográfica, HA
- **Idempotencia simple** - Basada en referencia, no en claves criptográficas

## 📄 Licencia

Proyecto académico - Ingeniería Web - Semana 13

---

**Desarrollado para cumplir los criterios de la rúbrica: Backend & API REST, Arquitectura Frontend, Gestión de Estado, Diseño y Estilos, Documentación y Entregables.**