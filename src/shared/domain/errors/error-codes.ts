/**
 * Diccionario centralizado de errores de negocio.
 * Sigue el formato: { statusCode: number, errorCode: string, message: string }
 */
export const ERROR_CODES = {
  // Validación
  INVALID_INPUT: {
    statusCode: 400,
    errorCode: 'VAL_001',
    message: 'Datos de entrada inválidos',
  },
  MISSING_REQUIRED_FIELDS: {
    statusCode: 400,
    errorCode: 'VAL_002',
    message: 'Faltan campos obligatorios en la solicitud',
  },

  // Autenticación / Autorización
  UNAUTHORIZED: {
    statusCode: 401,
    errorCode: 'AUTH_001',
    message: 'No autorizado',
  },
  FORBIDDEN: {
    statusCode: 403,
    errorCode: 'AUTH_002',
    message: 'Acceso denegado',
  },

  // Recursos no encontrados
  NOT_FOUND: {
    statusCode: 404,
    errorCode: 'RES_001',
    message: 'Recurso no encontrado',
  },

  // Conflictos de negocio
  ALREADY_EXISTS: {
    statusCode: 409,
    errorCode: 'BIZ_001',
    message: 'El recurso ya existe',
  },

  // Errores internos
  INTERNAL_ERROR: {
    statusCode: 500,
    errorCode: 'INT_001',
    message: 'Error interno al procesar la solicitud',
  },
} as const;

export type AppErrorCode = keyof typeof ERROR_CODES;
