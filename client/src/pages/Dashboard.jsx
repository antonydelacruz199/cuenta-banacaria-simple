import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { SaldoCard } from '../components/SaldoCard';
import { FormOperacion } from '../components/FormOperacion';
import { HistorialTransacciones } from '../components/HistorialTransacciones';
import { SelectorCuenta } from '../components/SelectorCuenta';
import { useCuenta, useHistorial, useOperacion } from '../hooks/useCuenta';
import { api } from '../services/api';

// Números de cuenta disponibles en la base de desarrollo (seed).
// La carga se centraliza en el servicio API; ningún componente hace fetch directo.
const NUMEROS_CUENTA = [
  'PE0010000001',
  'PE0010000002',
  'PE0010000003',
  'PE0010000004',
  'PE0010000005',
];

export function Dashboard() {
  const [cuentaId, setCuentaId] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [cargandoCuentas, setCargandoCuentas] = useState(true);
  const [errorCuentas, setErrorCuentas] = useState(null);
  const [paginaHistorial, setPaginaHistorial] = useState(1);

  const { cuenta, loading: loadingCuenta, error: errorCuenta, recargar: recargarCuenta } = useCuenta(cuentaId);
  const {
    movimientos,
    paginacion,
    loading: loadingHistorial,
    loadingMore,
    error: errorHistorial,
    recargar: recargarHistorial,
  } = useHistorial(cuentaId, paginaHistorial);
  const {
    loading: loadingOperacion,
    error: errorOperacion,
    success: successOperacion,
    ejecutar: ejecutarOperacion,
    limpiar: limpiarOperacion,
  } = useOperacion();

  // Cargar lista de cuentas al montar (solo lectura)
  useEffect(() => {
    let montado = true;
    const cargarCuentas = async () => {
      try {
        setCargandoCuentas(true);
        setErrorCuentas(null);
        // Las cuentas inactivas o inexistentes responden con error y se excluyen
        const resultados = await Promise.all(
          NUMEROS_CUENTA.map(numero => api.getCuenta(numero).then(r => r.data).catch(() => null))
        );
        if (!montado) return;
        const disponibles = resultados
          .filter(Boolean)
          .map(c => ({ _id: c.id, numeroCuenta: c.numeroCuenta, titular: c.titular, saldo: c.saldo }));
        setCuentas(disponibles);
        if (disponibles.length === 0) {
          setErrorCuentas('No se pudieron cargar las cuentas. Verifique que el backend y MongoDB estén en ejecución.');
        }
      } catch {
        if (montado) {
          setErrorCuentas('Error al cargar la lista de cuentas');
        }
      } finally {
        if (montado) setCargandoCuentas(false);
      }
    };
    cargarCuentas();
    return () => { montado = false; };
  }, []);

  // Seleccionar primera cuenta disponible
  useEffect(() => {
    if (cuentas.length > 0 && !cuentaId) {
      setCuentaId(cuentas[0]._id);
    }
  }, [cuentas, cuentaId]);

  // Recargar cuenta e historial tras operación exitosa.
  // Si la página del historial no es 1, volver a la página 1 recarga y descarta
  // la lista acumulada; si ya está en 1, se recarga explícitamente.
  useEffect(() => {
    if (successOperacion && cuentaId) {
      recargarCuenta();
      if (paginaHistorial !== 1) {
        setPaginaHistorial(1);
      } else {
        recargarHistorial(1);
      }
      limpiarOperacion();
    }
  }, [successOperacion, cuentaId, paginaHistorial, recargarCuenta, recargarHistorial, limpiarOperacion]);

  // Actualizar lista de cuentas local cuando cambia el saldo de la cuenta actual
  useEffect(() => {
    if (cuenta) {
      setCuentas(prev => prev.map(c =>
        c._id === cuenta.id ? { ...c, saldo: cuenta.saldo } : c
      ));
    }
  }, [cuenta]);

  const manejarDeposito = (cuentaId, monto, descripcion, referencia) => {
    return ejecutarOperacion(api.deposito, cuentaId, monto, descripcion, referencia);
  };

  const manejarRetiro = (cuentaId, monto, descripcion, referencia) => {
    return ejecutarOperacion(api.retiro, cuentaId, monto, descripcion, referencia);
  };

  const manejarTransferencia = async (cuentaOrigenId, cuentaDestinoId, monto, descripcion, referencia) => {
    const resultado = await ejecutarOperacion(api.transferencia, cuentaOrigenId, cuentaDestinoId, monto, descripcion, referencia);
    // La cuenta destino también cambió: sincronizar su saldo en la lista local
    // con lo devuelto por el backend (solo se llega aquí si la operación fue exitosa)
    if (resultado?.data?.cuentaDestino) {
      const destino = resultado.data.cuentaDestino;
      setCuentas(prev => prev.map(c => c._id === destino.id ? { ...c, saldo: destino.saldo } : c));
    }
    return resultado;
  };

  const manejarCambioCuenta = useCallback((nuevaCuentaId) => {
    setCuentaId(nuevaCuentaId);
    setPaginaHistorial(1);
    limpiarOperacion();
  }, [limpiarOperacion]);

  const cargarMasHistorial = () => {
    if (paginacion.hayMas && !loadingHistorial && !loadingMore) {
      setPaginaHistorial(p => p + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Selector de cuenta */}
        <div className="mb-6">
          <SelectorCuenta
            cuentas={cuentas}
            cuentaActualId={cuentaId}
            onChange={manejarCambioCuenta}
            loading={cargandoCuentas}
          />
          {errorCuentas && (
            <p className="mt-2 text-sm text-danger-600">{errorCuentas}</p>
          )}
        </div>

        {/* Saldo y datos de la cuenta */}
        <div className="mb-6">
          <SaldoCard
            cuenta={cuenta}
            loading={loadingCuenta}
            error={errorCuenta}
          />
        </div>

        {/* Operaciones */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <FormOperacion
            tipo="deposito"
            titulo="Depositar Fondos"
            icono={
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182C9.099 7.541 9.955 7.77 10.518 8.212z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            colorClase="bg-primary-100 text-primary-800"
            onSubmit={manejarDeposito}
            loading={loadingCuenta}
            cuentas={cuentas}
            cuentaActualId={cuentaId}
            deshabilitado={!cuentaId || loadingOperacion}
          />

          <FormOperacion
            tipo="retiro"
            titulo="Retirar Fondos"
            icono={
              <svg className="w-5 h-5 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            colorClase="bg-danger-100 text-danger-800"
            onSubmit={manejarRetiro}
            loading={loadingCuenta}
            cuentas={cuentas}
            cuentaActualId={cuentaId}
            deshabilitado={!cuentaId || loadingOperacion}
          />

          <FormOperacion
            tipo="transferencia"
            titulo="Transferir Fondos"
            icono={
              <svg className="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 18H9m1.125-12l-2.25 2.25L9 15.75m6-7.5l-2.25 2.25L15 9.75m-6 7.5h.008v.008H12V12z" />
              </svg>
            }
            colorClase="bg-warning-100 text-warning-800"
            onSubmit={manejarTransferencia}
            loading={loadingCuenta}
            cuentas={cuentas}
            cuentaActualId={cuentaId}
            deshabilitado={!cuentaId || loadingOperacion || cuentas.length <= 1}
          />
        </div>

        {/* Mensajes de operación */}
        {(errorOperacion || successOperacion) && (
          <div className={`mb-6 p-4 rounded-lg animate-slide-up ${errorOperacion ? 'bg-danger-50 border border-danger-200' : 'bg-success-50 border border-success-200'}`}>
            <div className="flex items-center gap-3">
              {errorOperacion ? (
                <svg className="w-5 h-5 text-danger-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-success-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.177-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              )}
              <p className={errorOperacion ? 'text-danger-700' : 'text-success-700'}>
                {errorOperacion || successOperacion}
              </p>
              <button
                onClick={limpiarOperacion}
                className="ml-auto text-sm font-medium hover:underline"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Historial */}
        <HistorialTransacciones
          movimientos={movimientos}
          loading={loadingHistorial}
          error={errorHistorial}
          empty={movimientos.length === 0 && !loadingHistorial && !errorHistorial}
          onLoadMore={cargarMasHistorial}
          hasMore={paginacion.hayMas}
          loadingMore={loadingMore}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-sm text-gray-500">
          <p>Sistema de Gestión de Cuenta Bancaria Simplificada - Simulación Académica</p>
          <p className="mt-1">Moneda: PEN (Sol Peruano) | Los saldos se manejan en céntimos para precisión</p>
        </div>
      </footer>
    </div>
  );
}
