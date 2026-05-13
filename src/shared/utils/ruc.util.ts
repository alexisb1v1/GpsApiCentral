/**
 * Valida un RUC peruano usando el algoritmo Módulo 11 de la SUNAT.
 */
export function isValidRuc(ruc: string): boolean {
  // 1. Debe existir, ser string y tener exactamente 11 dígitos numéricos
  if (!ruc || typeof ruc !== 'string' || !/^\d{11}$/.test(ruc)) {
    return false;
  }

  // 2. En Perú, los RUCs válidos empiezan con 10, 15, 17 o 20
  const validPrefixes = ['10', '15', '17', '20'];
  const prefix = ruc.substring(0, 2);
  if (!validPrefixes.includes(prefix)) {
    return false;
  }

  // 3. Algoritmo de validación Módulo 11
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digits = ruc.split('').map(Number);
  const checkDigit = digits.pop(); // Extraemos el último dígito (el verificador)

  let sum = 0;
  for (let i = 0; i < multipliers.length; i++) {
    sum += digits[i] * multipliers[i];
  }

  const remainder = sum % 11;
  let calculatedCheckDigit = 11 - remainder;

  // Reglas especiales del algoritmo SUNAT
  if (calculatedCheckDigit === 10) calculatedCheckDigit = 0;
  if (calculatedCheckDigit === 11) calculatedCheckDigit = 1;

  // 4. Comparamos el dígito calculado con el dígito verificador del RUC
  return calculatedCheckDigit === checkDigit;
}
