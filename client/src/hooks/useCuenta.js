import { useState, useEffect, useCallback, useRef } from 'react';
import { api, ApiError } from '../services/api';

export function useCuenta(cuentaId) {
  const [cuenta, setCuenta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Refs con el valor vigente: permiten descartar respuestas fuera de orden
  // (una respuesta tardía de una cuenta anterior no debe sobreescribir la actual)
  const cuentaIdRef = useRef(cuentaId);
  cuentaIdRef.current = cuentaId;

  const cargarCuenta = useCallback(async () => {
    const idSolicitado = cuentaIdRef.current;
    if (!idSolicitado) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.getCuenta(idSolicitado);
      if (cuentaIdRef.current !== idSolicitado) return; // respuesta de otra cuenta: descartar
      if (response.success && response.data) {
        setCuenta(response.data);
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (err) {
      if (cuentaIdRef.current !== idSolicitado) return;
      const mensaje = err instanceof ApiError ? err.message : 'Error al cargar la cuenta';
      setError(mensaje);
      setCuenta(null);
    } finally {
      if (cuentaIdRef.current === idSolicitado) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cargarCuenta();
  }, [cargarCuenta, cuentaId]);

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
  const [movimientos, setMovimientos] = useState([]);
  const [paginacion, setPaginacion] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const cuentaIdRef = useRef(cuentaId);
  cuentaIdRef.current = cuentaId;
  const paginaRef = useRef(pagina);
  paginaRef.current = pagina;

  // Carga una página del historial con paginación del backend.
  // - Página 1: reemplaza la lista (recarga tras operación o cambio de cuenta).
  // - Página > 1: acumula los resultados al final ("cargar más"), sin perder los anteriores.
  const cargarHistorial = useCallback(async (p) => {
    const idSolicitado = cuentaIdRef.current;
    if (!idSolicitado) return;

    const destino = Number(p) > 0 ? Number(p) : (paginaRef.current || 1);
    const acumular = destino > 1;

    if (acumular) setLoadingMore(true); else setLoading(true);
    setError(null);

    try {
      const response = await api.getHistorial(idSolicitado, destino, limite);
      // Descartar respuestas fuera de orden (cuenta o página ya no es la vigente)
      if (cuentaIdRef.current !== idSolicitado || paginaRef.current !== destino) return;
      if (response.success && response.data) {
        setMovimientos(prev => acumular
          ? [...prev, ...response.data.movimientos]
          : response.data.movimientos
        );
        setPaginacion(response.data.paginacion || {});
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (err) {
      if (cuentaIdRef.current !== idSolicitado || paginaRef.current !== destino) return;
      setError(err instanceof ApiError ? err.message : 'Error al cargar el historial');
      if (!acumular) {
        setMovimientos([]);
        setPaginacion({});
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [limite]);

  useEffect(() => {
    cargarHistorial(pagina);
  }, [cargarHistorial, pagina, cuentaId]);

  return {
    movimientos,
    paginacion,
    loading,
    loadingMore,
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
