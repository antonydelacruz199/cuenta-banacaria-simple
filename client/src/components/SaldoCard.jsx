import React from 'react';
import { formatearMoneda } from '../utils/formatters';

export function SaldoCard({ cuenta, loading, error }) {
  if (loading) {
    return (
      <div className="card p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
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
            <p className="font-medium">Error al cargar la cuenta</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!cuenta) {
    return (
      <div className="card p-6 text-center text-gray-500">
        <p>No hay cuenta seleccionada</p>
      </div>
    );
  }

  return (
    <div className="card-elevated p-6 bg-gradient-to-br from-primary-50 via-white to-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6H.75a.75.75 0 010-1.5h2.25M3.75 4.5h16.5M17.25 18a4.5 4.5 0 00-7.232-2.418M17.25 18a4.5 4.5 0 01-7.232-2.418m7.232 2.418c0 2.148-.985 4.075-2.565 5.31" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Saldo Disponible</p>
            <p className="text-3xl sm:text-4xl font-bold text-gray-900 tabular-nums">
              {formatearMoneda(cuenta.saldo)}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:items-end gap-2 text-right sm:mr-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="px-2 py-0.5 rounded bg-gray-100 font-mono text-xs">{cuenta.numeroCuenta}</span>
          </div>
          <p className="text-sm text-gray-500">{cuenta.titular}</p>
        </div>
      </div>
      
      <div className="mt-6 pt-6 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Actualizado: {new Date(cuenta.fechaActualizacion).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-full bg-success-100 text-success-800 text-xs font-medium">
            {cuenta.moneda}
          </span>
          {cuenta.activa ? (
            <span className="px-2 py-1 rounded-full bg-success-100 text-success-800 text-xs font-medium">Activa</span>
          ) : (
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">Inactiva</span>
          )}
        </div>
      </div>
    </div>
  );
}