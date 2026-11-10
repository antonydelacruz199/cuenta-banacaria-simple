import React, { useState, useEffect } from 'react';
import { formatearMoneda, parsearMoneda, validarMonto, generarReferencia } from '../utils/formatters';

export function FormOperacion({ 
  tipo, 
  titulo, 
  icono, 
  colorClase, 
  onSubmit, 
  loading, 
  cuentas,
  cuentaActualId,
  deshabilitado = false 
}) {
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cuentaDestino, setCuentaDestino] = useState('');
  const [error, setError] = useState('');
  const [montoValido, setMontoValido] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Validar monto en tiempo real
  useEffect(() => {
    const centimos = parsearMoneda(monto);
    const validacion = validarMonto(centimos);
    setMontoValido(validacion.valido);
    if (!validacion.valido && monto) {
      setError(validacion.error);
    } else {
      setError('');
    }
  }, [monto]);

  const manejarSubmit = async (e) => {
    e.preventDefault();
    
    const centimos = parsearMoneda(monto);
    const validacion = validarMonto(centimos);
    
    if (!validacion.valido) {
      setError(validacion.error);
      return;
    }
    
    if (tipo === 'transferencia' && !cuentaDestino) {
      setError('Seleccione una cuenta de destino');
      return;
    }
    
    if (tipo === 'transferencia' && cuentaDestino === cuentaActualId) {
      setError('No puede transferir a la misma cuenta');
      return;
    }
    
    setEnviando(true);
    setError('');
    
    try {
      const referencia = generarReferencia(tipo.toUpperCase().substring(0, 3));
      
      if (tipo === 'deposito') {
        await onSubmit(cuentaActualId, centimos, descripcion, referencia);
      } else if (tipo === 'retiro') {
        await onSubmit(cuentaActualId, centimos, descripcion, referencia);
      } else if (tipo === 'transferencia') {
        await onSubmit(cuentaActualId, cuentaDestino, centimos, descripcion, referencia);
      }
    } catch (err) {
      setError(err.message || 'Error en la operación');
    } finally {
      setEnviando(false);
    }
  };

  const manejarMontoChange = (e) => {
    // Permitir solo números, punto, coma y backspace
    const valor = e.target.value.replace(/[^0-9.,]/g, '');
    setMonto(valor);
  };

  return (
    <div className="card p-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-10 h-10 rounded-xl ${colorClase} flex items-center justify-center`}>
          {icono}
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
      </div>

      <form onSubmit={manejarSubmit} className="space-y-4">
        {tipo === 'transferencia' && (
          <div>
            <label htmlFor="cuentaDestino" className="label">Cuenta de Destino</label>
            <select
              id="cuentaDestino"
              value={cuentaDestino}
              onChange={(e) => setCuentaDestino(e.target.value)}
              className="input"
              disabled={loading || enviando || deshabilitado}
              required
            >
              <option value="">Seleccionar cuenta destino</option>
              {cuentas.filter(c => c._id !== cuentaActualId).map(cuenta => (
                <option key={cuenta._id} value={cuenta._id}>
                  {cuenta.numeroCuenta} - {cuenta.titular} ({formatearMoneda(cuenta.saldo)})
                </option>
              ))}
            </select>
            {cuentas.filter(c => c._id !== cuentaActualId).length === 0 && (
              <p className="text-sm text-gray-500 mt-1">No hay otras cuentas disponibles</p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="monto" className="label">Monto (PEN)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-medium">S/</span>
            <input
              id="monto"
              type="text"
              value={monto}
              onChange={manejarMontoChange}
              onBlur={(e) => {
                // Formatear al perder foco
                const centimos = parsearMoneda(e.target.value);
                if (centimos > 0) {
                  setMonto(formatearMoneda(centimos));
                }
              }}
              placeholder="0.00"
              className={`input pl-8 text-right ${!montoValido && monto ? 'input-error' : ''}`}
              disabled={loading || enviando || deshabilitado}
              required
              autoComplete="off"
            />
          </div>
          {!montoValido && monto && (
            <p className="mt-1 text-sm text-danger-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              {error || 'Monto inválido'}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="descripcion" className="label">Descripción (opcional)</label>
          <textarea
            id="descripcion"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            placeholder={`Descripción del ${tipo.toLowerCase()}`}
            className="input resize-none"
            disabled={loading || enviando || deshabilitado}
            maxLength={200}
          />
          <p className="mt-1 text-xs text-gray-500 text-right">{descripcion.length}/200</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-danger-50 border border-danger-200 flex items-center gap-2 text-danger-700 text-sm animate-slide-up">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || enviando || deshabilitado || !montoValido || (tipo === 'transferencia' && !cuentaDestino)}
          className={`btn w-full ${colorClase === 'bg-primary-100 text-primary-800' ? 'btn-primary' : colorClase === 'bg-danger-100 text-danger-800' ? 'btn-danger' : 'btn-success'}`}
        >
          {enviando && (
            <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {enviando ? 'Procesando...' : `Realizar ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`}
        </button>
      </form>
    </div>
  );
}