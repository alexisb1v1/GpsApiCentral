import { AppErrorCode } from './error-codes';

/**
 * Representa los errores de negocio permitidos en la aplicación.
 * Se utiliza con el patrón Result de neverthrow.
 */
export type AppError = AppErrorCode;
