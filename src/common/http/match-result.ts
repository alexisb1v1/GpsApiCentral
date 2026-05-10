import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Result } from 'neverthrow';
import { AppError } from '../../shared/domain/errors/app-errors';
import { ERROR_CODES } from '../../shared/domain/errors/error-codes';

/**
 * Helper para mapear el patrón Result de neverthrow a respuestas HTTP de NestJS.
 * 
 * @param result - El resultado de la operación (ok o err)
 * @param onSuccess - Función que se ejecuta si el resultado es exitoso
 * @param messages - Mensajes personalizados opcionales para errores específicos
 * @returns La respuesta exitosa o lanza una HttpException
 */
export function matchResult<T>(
  result: Result<T, AppError>,
  onSuccess: (data: T) => any = (data) => data,
  messages?: Partial<Record<AppError, string>>,
): any {
  return result.match(onSuccess, (error) => {
    const errorConfig = ERROR_CODES[error];
    const msg = messages?.[error] ?? errorConfig.message;

    switch (error) {
      case 'NOT_FOUND':
        throw new NotFoundException({
          statusCode: 404,
          errorCode: errorConfig.errorCode,
          message: msg,
        });
      case 'ALREADY_EXISTS':
        throw new ConflictException({
          statusCode: 409,
          errorCode: errorConfig.errorCode,
          message: msg,
        });
      case 'UNAUTHORIZED':
        throw new UnauthorizedException({
          statusCode: 401,
          errorCode: errorConfig.errorCode,
          message: msg,
        });
      case 'FORBIDDEN':
        throw new ForbiddenException({
          statusCode: 403,
          errorCode: errorConfig.errorCode,
          message: msg,
        });
      case 'INVALID_INPUT':
      case 'MISSING_REQUIRED_FIELDS':
        throw new BadRequestException({
          statusCode: 400,
          errorCode: errorConfig.errorCode,
          message: msg,
        });
      default:
        throw new InternalServerErrorException({
          statusCode: 500,
          errorCode: errorConfig.errorCode,
          message: msg,
        });
    }
  });
}
