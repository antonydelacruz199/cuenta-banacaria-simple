import React, { useState } from 'react';
import { formatearMoneda } from '../utils/formatters';

export function SelectorCuenta({ cuentas, cuentaActualId, onChange, loading }) {
  const [abierto, setAbierto] = useState(false);

  const cuentaActual = cuentas.find(c => c._id === cuentaActualId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="w-full btn btn-secondary justify-between"
        disabled={loading}
        aria-haspopup="listbox"
        aria-expanded={abierto}
      >
        <span className="text-left flex-1">
          {cuentaActual ? (
            <>
              <span className="font-medium">{cuentaActual.titular}</span>
              <span className="text-sm text-gray-500 ml-2">{cuentaActual.numeroCuenta}</span>
            </>
          ) : (
            'Seleccionar cuenta...'
          )}
        </span>
        <svg className={`w-5 h-5 text-gray-500 transition-transform ${abierto ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} aria-hidden="true" />
          <div className="absolute z-20 w-full mt-1 card-elevated rounded-lg shadow-lg border border-gray-200 animate-fade-in">
            <div className="p-2 max-h-60 overflow-y-auto">
              {cuentas.map(cuenta => (
                <button
                  key={cuenta._id}
                  type="button"
                  onClick={() => {
                    onChange(cuenta._id);
                    setAbierto(false);
                  }}
                  className={`w-full px-4 py-3 text-left rounded-lg transition-colors ${
                    cuenta._id === cuentaActualId
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{cuenta.titular}</p>
                      <p className="text-sm text-gray-500">{cuenta.numeroCuenta}</p>
                    </div>
                    <span className="font-mono font-medium text-gray-900">
                      {formatearMoneda(cuenta.saldo)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}