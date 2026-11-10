// Cliente API para comunicación con el backend
const API_BASE = '/api';

class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    throw new ApiError(
      data.error || 'Error en la solicitud',
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
    const response = await fetch(`${API_BASE}/cuenta/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  // POST /api/cuenta/deposito
  async deposito(cuentaId, monto, descripcion = '', referencia = null) {
    const response = await fetch(`${API_BASE}/cuenta/deposito`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuentaId, monto, descripcion, referencia }),
    });
    return handleResponse(response);
  },

  // POST /api/cuenta/retiro
  async retiro(cuentaId, monto, descripcion = '', referencia = null) {
    const response = await fetch(`${API_BASE}/cuenta/retiro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuentaId, monto, descripcion, referencia }),
    });
    return handleResponse(response);
  },

  // POST /api/cuenta/transferencia
  async transferencia(cuentaOrigenId, cuentaDestinoId, monto, descripcion = '', referencia = null) {
    const response = await fetch(`${API_BASE}/cuenta/transferencia`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cuentaOrigenId, cuentaDestinoId, monto, descripcion, referencia }),
    });
    return handleResponse(response);
  },

  // GET /api/cuenta/:id/historial
  async getHistorial(id, pagina = 1, limite = 20) {
    const params = new URLSearchParams({ pagina: pagina.toString(), limite: limite.toString() });
    const response = await fetch(`${API_BASE}/cuenta/${encodeURIComponent(id)}/historial?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse(response);
  },

  // Health check
  async health() {
    const response = await fetch(`${API_BASE}/health`);
    return handleResponse(response);
  },
};

export { ApiError };