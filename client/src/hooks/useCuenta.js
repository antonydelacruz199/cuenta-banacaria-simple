import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '../services/api';

export function useCuenta(cuentaId) {
  const [cuenta, setCuenta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarCuenta = useCallback(async () => {
    if (!cuentaId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getCuenta(cuentaId);
      if (response.success && response.data) {
        setCuenta(response.data);
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'Error al cargar la cuenta';
      setError(mensaje);
      setCuenta(null);
    } finally {
      setLoading(false);
    }
  }, [cuentaId]);

  useEffect(() => {
    cargarCuenta();
  }, [cargarCuenta]);

  const actualizarSaldo = useCallback((nuevoSaldo, saldoFormateado) => {
    setCuenta(prev => prev ? { ...prev, saldo: nuevoSaldo, saldoFormateado } : null);
  }, []);

  return {
    cuenta,
    loading,
    error,
    recargar: cargarCuenta,
    actualizarSaldo,
  };
}

export function useHistorial(cuentaId, pagina = 1, limite = 20) {
  const [historial, setHistorial] = useState({ movimientos: [], paginacion: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cargarHistorial = useCallback(async (p = 1) => {
    if (!cuentaId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.getHistorial(cuentaId, p, limite);
      if (response.success && response.data) {
        setHistorial(response.data);
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'Error al cargar el historial';
      setError(mensaje);
      setHistorial({ movimientos: [], paginacion: {} });
    } finally {
      setLoading(false);
    }
  }, [cuentaId, limite]);

  useEffect(() => {
    cargarHistorial(pagina);
  }, [cargarHistorial, pagina]);

  return {
    movimientos: historial.movimientos,
    paginacion: historial.paginacion,
    loading,
    error,
    recargar: cargarHistorial,
  };
}

export function useOperacion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const ejecutar = useCallback(async (operacion, ...args) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const resultado = await operacion(...args);
      setSuccess(resultado.mensaje || 'Operación exitosa');
      return resultado;
    } catch (err) {
      const mensaje = err instanceof ApiError ? err.message : 'Error en la operación';
      setError(mensaje);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const limpiar = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return {
    loading,
    error,
    success,
    ejecutar,
    limpiar,
  };
}