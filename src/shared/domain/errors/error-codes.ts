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
  VEHICLE_NOT_FOUND: {
    statusCode: 404,
    errorCode: 'RES_002',
    message: 'El vehículo especificado no existe',
  },
  VEHICLE_TENANT_MISMATCH: {
    statusCode: 403,
    errorCode: 'AUTH_003',
    message: 'El vehículo no pertenece a su misma empresa',
  },
  DRIVER_NOT_FOUND: {
    statusCode: 404,
    errorCode: 'RES_003',
    message: 'El conductor especificado no existe o no está registrado',
  },
  DRIVER_TENANT_MISMATCH: {
    statusCode: 403,
    errorCode: 'AUTH_004',
    message: 'El conductor no pertenece a su misma empresa',
  },
  ROUTE_NOT_FOUND: {
    statusCode: 404,
    errorCode: 'RES_004',
    message: 'La ruta especificada no existe',
  },
  ROUTE_TENANT_MISMATCH: {
    statusCode: 403,
    errorCode: 'AUTH_005',
    message: 'La ruta no pertenece a su misma empresa',
  },

  // Conflictos de negocio
  ALREADY_EXISTS: {
    statusCode: 409,
    errorCode: 'BIZ_001',
    message: 'El recurso ya existe',
  },
  DRIVER_ALREADY_ASSIGNED: {
    statusCode: 409,
    errorCode: 'BIZ_002',
    message: 'El conductor especificado ya cuenta con una unidad asignada para este día de trabajo',
  },

  // Errores de integración externa
  TRACCAR_API_ERROR: {
    statusCode: 500,
    errorCode: 'TRAC_001',
    message: 'Error al comunicarse con el servidor de Traccar',
  },
  TRACCAR_DEVICE_ALREADY_EXISTS: {
    statusCode: 409,
    errorCode: 'TRAC_002',
    message: 'El identificador (IMEI / ID App) ya está registrado en el servidor de Traccar',
  },

  // Errores internos
  INTERNAL_ERROR: {
    statusCode: 500,
    errorCode: 'INT_001',
    message: 'Error interno al procesar la solicitud',
  },
} as const;

export type AppErrorCode = keyof typeof ERROR_CODES;
