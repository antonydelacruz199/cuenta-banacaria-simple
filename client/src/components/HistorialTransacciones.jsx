import React from 'react';
import { formatearMoneda, formatearFecha, getBadgeClass, getTipoLabel } from '../utils/formatters';

export function HistorialTransacciones({ movimientos, loading, error, empty, onLoadMore, hasMore, loadingMore }) {
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Historial de Movimientos
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="p-4 animate-pulse">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-200"></div>
                  <div className="space-y-1">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                    <div className="h-3 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 border-danger-200">
        <div className="flex items-center gap-3 text-danger-600">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div>
            <p className="font-medium">Error al cargar el historial</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (empty || (movimientos && movimientos.length === 0)) {
    return (
      <div className="card p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Sin movimientos</h3>
        <p className="text-gray-500">No hay transacciones registradas en esta cuenta</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Historial de Movimientos
        </h2>
      </div>
      
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto scrollbar-thin">
        {movimientos.map((movimiento, index) => (
          <MovimientoItem key={movimiento.id || index} movimiento={movimiento} />
        ))}
      </div>
      
      {hasMore && (
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="btn btn-secondary w-full"
          >
            {loadingMore ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Cargando más...
              </>
            ) : (
              'Cargar más movimientos'
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function MovimientoItem({ movimiento }) {
  const badgeClass = getBadgeClass(movimiento.tipo);
  const tipoLabel = getTipoLabel(movimiento.tipo);
  const esEntrada = ['deposito', 'transferencia_recibida'].includes(movimiento.tipo);
  const esSalida = ['retiro', 'transferencia_enviada'].includes(movimiento.tipo);
  
  // Determinar monto a mostrar (positivo para entradas, negativo para salidas)
  const montoMostrar = esSalida ? -movimiento.monto : movimiento.monto;
  const montoClass = esEntrada ? 'text-success-600' : esSalida ? 'text-danger-600' : 'text-gray-900';
  const signo = esEntrada ? '+' : esSalida ? '-' : '';

  return (
    <div className="p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${badgeClass.replace('badge-', 'bg-').replace('text-', '')}/20`}>
          {getIconoMovimiento(movimiento.tipo)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={badgeClass}>{tipoLabel}</span>
              <span className="text-sm text-gray-500">{formatearFecha(movimiento.fecha)}</span>
            </div>
            <span className={`font-mono font-semibold ${montoClass} whitespace-nowrap`}>
              {signo}{formatearMoneda(Math.abs(montoMostrar))}
            </span>
          </div>
          
          {movimiento.descripcion && (
            <p className="mt-1 text-sm text-gray-600 line-clamp-1">{movimiento.descripcion}</p>
          )}
          
          {(movimiento.cuentaOrigen || movimiento.cuentaDestino) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              {movimiento.cuentaOrigen && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  De: {movimiento.cuentaOrigen.numeroCuenta} ({movimiento.cuentaOrigen.titular})
                </span>
              )}
              {movimiento.cuentaDestino && (
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  A: {movimiento.cuentaDestino.numeroCuenta} ({movimiento.cuentaDestino.titular})
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getIconoMovimiento(tipo) {
  const iconos = {
    deposito: (
      <svg className="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182C9.099 7.541 9.955 7.77 10.518 8.212z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    retiro: (
      <svg className="w-5 h-5 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    transferencia_enviada: (
      <svg className="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.75 18.75a1.25 1.25 0 01-1.25-1.25v-11.5A2.25 2.25 0 019.75 4h9.5a2.25 2.25 0 012.25 2.25V11.5a2.25 2.25 0 01-2.25 2.25h-3.5v5.5H8.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15h.008v.008H12V15z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9.75H12" />
      </svg>
    ),
    transferencia_recibida: (
      <svg className="w-5 h-5 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.25 18.75a1.25 1.25 0 001.25-1.25v-11.5A2.25 2.25 0 0014.25 4h-9.5A2.25 2.25 0 002.5 6.25V11.5A2.25 2.25 0 004.75 13.75h3.5v5.5H15.25z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15h.008v.008H12V15z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 9.75h7" />
      </svg>
    ),
  };
  return iconos[tipo] || iconos.deposito;
}