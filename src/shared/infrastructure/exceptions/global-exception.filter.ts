import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ERROR_CODES } from '../../domain/errors/error-codes';

/**
 * Filtro global de excepciones para sanitizar las respuestas de error.
 * Evita la exposición de stack traces y detalles internos en producción.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = ERROR_CODES.INTERNAL_ERROR.message;
    let errorCode = ERROR_CODES.INTERNAL_ERROR.errorCode;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      // Manejar respuestas estructuradas (como las de matchResult)
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || message;
        errorCode = (exceptionResponse as any).errorCode || 'ERR_UNKNOWN';
      } else {
        message = exception.message;
      }
    } else {
      // Error no controlado (500) - Loguear para depuración
      this.logger.error('Unhandled exception caught:', exception);
    }

    response.status(status).json({
      statusCode: status,
      errorCode: errorCode,
      message: message,
    });
  }
}
