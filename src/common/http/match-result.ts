import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Result } from 'neverthrow';
import { AppError } from '@shared/domain/errors/app-errors';
import { ERROR_CODES } from '@shared/domain/errors/error-codes';
import { PaginatedResult } from '@common/interfaces/paginated-result.interface';

/**
 * Estructura estándar de respuesta de la API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  data: T | null;
  meta?: {
    pagination?: {
      totalItems: number;
      itemCount: number;
      itemsPerPage: number;
      totalPages: number;
      currentPage: number;
    };
    timestamp: string;
  };
}

/**
 * Helper para mapear el patrón Result de neverthrow a respuestas HTTP de NestJS.
 */
export function matchResult<T>(
  result: Result<T, AppError>,
  onSuccess: (data: T) => any = (data) => data,
  messages?: Partial<Record<AppError, string>>,
): ApiResponse {
  return result.match(
    (data) => {
      const processedData = onSuccess(data);
      const response: ApiResponse = {
        success: true,
        errorCode: null,
        errorMessage: null,
        data: processedData,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };

      // Si la data es un resultado paginado, movemos la meta-data a meta.pagination
      if (processedData && typeof processedData === 'object' && 'items' in processedData && 'totalItems' in processedData) {
        const paginated = processedData as PaginatedResult<any>;
        response.data = paginated.items;
        response.meta!.pagination = {
          totalItems: paginated.totalItems,
          itemCount: paginated.items.length,
          itemsPerPage: paginated.itemsPerPage,
          totalPages: paginated.totalPages,
          currentPage: paginated.currentPage,
        };
      }

      return response;
    },
    (error) => {
      const errorConfig = ERROR_CODES[error];
      const msg = messages?.[error] ?? errorConfig.message;
      
      const errorBody: ApiResponse = {
        success: false,
        errorCode: errorConfig.errorCode,
        errorMessage: msg,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
        }
      };

      switch (error) {
        case 'NOT_FOUND':
          throw new NotFoundException(errorBody);
        case 'ALREADY_EXISTS':
          throw new ConflictException(errorBody);
        case 'UNAUTHORIZED':
          throw new UnauthorizedException(errorBody);
        case 'FORBIDDEN':
          throw new ForbiddenException(errorBody);
        case 'INVALID_INPUT':
        case 'MISSING_REQUIRED_FIELDS':
          throw new BadRequestException(errorBody);
        default:
          throw new InternalServerErrorException(errorBody);
      }
    },
  );
}
