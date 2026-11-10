// Cliente API para comunicación con el backend
// Todas las llamadas HTTP del frontend se centralizan aquí: los componentes
// no deben realizar fetch directamente.
const API_BASE = '/api';

// Tiempo máximo de espera por solicitud; evita esperas indefinidas si el
// backend o MongoDB no responden
const TIMEOUT_MS = 15000;

class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Solicitud con timeout. NO reintenta automáticamente: en operaciones bancarias
// un reintento con nueva referencia podría duplicar la operación.
async function solicitar(url, opciones = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opciones, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError(
        'El servidor no respondió a tiempo. Verifique el resultado en el historial antes de reintentar la operación.',
        0,
        'TIMEOUT'
      );
    }
    throw new ApiError(
      'No se pudo conectar con el servidor. Verifique que el backend y MongoDB estén en ejecución.',
      0,
      'NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timer);
  }
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Respuesta de error del backend: { success, error, code, details }
    throw new ApiError(
      data.error || `Error ${response.status} del servidor`,
      response.status,
      data.code,
      data.details
    );
  }

  return data;
}

export const api = {
  // GET /api/cuenta/:id
  async getCuenta(id) {
    const response = await solicitar(`${API_BASE}/cuenta/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  // POST /api/cuenta/deposito — monto en céntimos (entero)
  async deposito(cuentaId, monto, descripcion = '', referencia = null) {
    const response = await solicitar(`${API_BASE}/cuenta/deposito`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuentaId, monto, descripcion, referencia }),
    });
    return handleResponse(response);
  },

  // POST /api/cuenta/retiro — monto en céntimos (entero)
  async retiro(cuentaId, monto, descripcion = '', referencia = null) {
    const response = await solicitar(`${API_BASE}/cuenta/retiro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuentaId, monto, descripcion, referencia }),
    });
    return handleResponse(response);
  },

  // POST /api/cuenta/transferencia — monto en céntimos (entero)
  async transferencia(cuentaOrigenId, cuentaDestinoId, monto, descripcion = '', referencia = null) {
    const response = await solicitar(`${API_BASE}/cuenta/transferencia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuentaOrigenId, cuentaDestinoId, monto, descripcion, referencia }),
    });
    return handleResponse(response);
  },

  // GET /api/cuenta/:id/historial
  async getHistorial(id, pagina = 1, limite = 20) {
    const params = new URLSearchParams({ pagina: pagina.toString(), limite: limite.toString() });
    const response = await solicitar(`${API_BASE}/cuenta/${encodeURIComponent(id)}/historial?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  // Health check
  async health() {
    const response = await solicitar(`${API_BASE}/health`);
    return handleResponse(response);
  },
};

export { ApiError };
