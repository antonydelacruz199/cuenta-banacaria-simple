// Tests unitarios del procesamiento monetario del cliente (formatters.js)
// Verifican: conversión exacta a céntimos, rechazo de formatos ambiguos/incorrectos,
// precisión sin punto flotante y conservación del valor en el ciclo formatear → interpretar.
import { describe, test, expect } from '@jest/globals';
import { parsearMoneda, formatearMoneda, validarMonto, CURRENCY } from '../../client/src/utils/formatters.js';

describe('parsearMoneda - conversión a céntimos', () => {
  test('"100.50" (punto decimal) → 10050 céntimos', () => {
    expect(parsearMoneda('100.50')).toBe(10050);
  });

  test('"100,50" (coma decimal) → 10050 céntimos', () => {
    expect(parsearMoneda('100,50')).toBe(10050);
  });

  test('"100" (entero) → 10000 céntimos', () => {
    expect(parsearMoneda('100')).toBe(10000);
  });

  test('"0.05" y "0,5" → centavos exactos', () => {
    expect(parsearMoneda('0.05')).toBe(5);
    expect(parsearMoneda('0,5')).toBe(50);
  });

  test('"19.99" → 1999 céntimos sin error de precisión flotante', () => {
    expect(parsearMoneda('19.99')).toBe(1999);
  });

  test('"S/ 1,250.00" (con símbolo) → 125000 céntimos', () => {
    expect(parsearMoneda('S/ 1,250.00')).toBe(125000);
  });

  test('millares con formato inequívoco "1,250.00" → 125000 céntimos', () => {
    expect(parsearMoneda('1,250.00')).toBe(125000);
  });

  test('millares con formato inequívoco "1.250,00" → 125000 céntimos', () => {
    expect(parsearMoneda('1.250,00')).toBe(125000);
  });

  test('millares sin decimales "1,250" → 125000 céntimos (1250 soles)', () => {
    expect(parsearMoneda('1,250')).toBe(125000);
  });

  test('millares múltiples "1.250.300" → 125030000 céntimos', () => {
    expect(parsearMoneda('1.250.300')).toBe(125030000);
  });

  test('decimales de un dígito "1250,5" → 125050 céntimos', () => {
    expect(parsearMoneda('1250,5')).toBe(125050);
  });

  test('mixto "1,250.5" → 125050 céntimos', () => {
    expect(parsearMoneda('1,250.5')).toBe(125050);
  });
});

describe('parsearMoneda - rechazo de formatos ambiguos o incorrectos', () => {
  test('entrada vacía → null', () => {
    expect(parsearMoneda('')).toBe(null);
    expect(parsearMoneda('   ')).toBe(null);
    expect(parsearMoneda(null)).toBe(null);
    expect(parsearMoneda(undefined)).toBe(null);
  });

  test('caracteres inválidos → null', () => {
    expect(parsearMoneda('abc')).toBe(null);
    expect(parsearMoneda('12a4')).toBe(null);
    expect(parsearMoneda('1 2 3')).toBe(null);
  });

  test('negativos → null (no se permiten montos negativos)', () => {
    expect(parsearMoneda('-5')).toBe(null);
    expect(parsearMoneda('-100.50')).toBe(null);
  });

  test('separadores inconsistentes → null', () => {
    expect(parsearMoneda('1.2.3')).toBe(null);
    expect(parsearMoneda('12,34,56')).toBe(null);
    expect(parsearMoneda('1,250.5.0')).toBe(null);
    expect(parsearMoneda('1,250,50')).toBe(null);
  });

  test('agrupación de millares inválida → null', () => {
    expect(parsearMoneda('1250.500')).toBe(null); // primer grupo de 4 dígitos
    expect(parsearMoneda('1,25,000')).toBe(null); // grupo intermedio de 2 dígitos
    expect(parsearMoneda('0,125')).toBe(null); // millares no empiezan con 0
  });

  test('más de dos decimales → null', () => {
    expect(parsearMoneda('100.5555')).toBe(null);
    expect(parsearMoneda('100,5555')).toBe(null);
  });

  test('símbolo sin importe → null', () => {
    expect(parsearMoneda('S/')).toBe(null);
  });
});

describe('formatearMoneda - visualización en soles', () => {
  test('formato con separador de millares y 2 decimales', () => {
    expect(formatearMoneda(125000)).toBe('S/ 1,250.00');
    expect(formatearMoneda(999999999)).toBe('S/ 9,999,999.99');
    expect(formatearMoneda(123456789)).toBe('S/ 1,234,567.89');
  });

  test('centavos y cero', () => {
    expect(formatearMoneda(1)).toBe('S/ 0.01');
    expect(formatearMoneda(5)).toBe('S/ 0.05');
    expect(formatearMoneda(0)).toBe('S/ 0.00');
  });

  test('valores nulos o no finitos → S/ 0.00', () => {
    expect(formatearMoneda(null)).toBe('S/ 0.00');
    expect(formatearMoneda(undefined)).toBe('S/ 0.00');
    expect(formatearMoneda(NaN)).toBe('S/ 0.00');
    expect(formatearMoneda(Infinity)).toBe('S/ 0.00');
  });
});

describe('Conservación del valor: formatear → volver a interpretar', () => {
  test('el round trip conserva exactamente el valor en céntimos', () => {
    const valores = [
      1, 5, 9, 10, 50, 99, 100, 101, 999, 1000, 1001,
      10050, 125000, 999999, 1000000, 1234567, 99999999,
      123456789, 100000000, 999999999,
    ];
    for (const centimos of valores) {
      const formateado = formatearMoneda(centimos);
      const reinterprete = parsearMoneda(formateado);
      expect(reinterprete).toBe(centimos);
    }
  });

  test('el monto máximo permitido sobrevive el round trip', () => {
    const maximo = 999999999;
    expect(parsearMoneda(formatearMoneda(maximo))).toBe(maximo);
  });
});

describe('validarMonto - reglas de negocio', () => {
  test('montos válidos', () => {
    expect(validarMonto(1)).toEqual({ valido: true, error: null });
    expect(validarMonto(10050)).toEqual({ valido: true, error: null });
    expect(validarMonto(999999999)).toEqual({ valido: true, error: null });
  });

  test('rechaza valores negativos y cero', () => {
    expect(validarMonto(0).valido).toBe(false);
    expect(validarMonto(-100).valido).toBe(false);
  });

  test('rechaza entradas vacías y nulas', () => {
    expect(validarMonto(null).valido).toBe(false);
    expect(validarMonto(undefined).valido).toBe(false);
    expect(validarMonto(NaN).valido).toBe(false);
  });

  test('rechaza valores no enteros (no finitos o fraccionarios)', () => {
    expect(validarMonto(100.5).valido).toBe(false);
    expect(validarMonto(Infinity).valido).toBe(false);
    expect(validarMonto(-Infinity).valido).toBe(false);
  });

  test('rechaza montos fuera del límite permitido', () => {
    expect(validarMonto(1000000000).valido).toBe(false);
    expect(validarMonto(999999999).valido).toBe(true);
    expect(validarMonto(1000000000).error).toBe('El monto excede el límite permitido');
  });
});

describe('Constantes de moneda', () => {
  test('PEN con 2 decimales', () => {
    expect(CURRENCY.CODE).toBe('PEN');
    expect(CURRENCY.DECIMALS).toBe(2);
  });
});
