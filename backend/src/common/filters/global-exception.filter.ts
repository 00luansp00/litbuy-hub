import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import type { ErrorResponse } from '../errors/error-response';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const errorBody = this.buildErrorResponse(exception, request);

    if (errorBody.statusCode >= 500) {
      this.logger.error({
        code: errorBody.code,
        message: errorBody.message,
        path: errorBody.path,
        requestId: errorBody.requestId,
      });
    }

    response.status(errorBody.statusCode).json(errorBody);
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.originalUrl || request.url;
    const requestId = request.requestId ?? 'unknown';

    if (exception instanceof AppError) {
      return {
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        details: exception.details,
        requestId,
        timestamp,
        path,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      const details = this.extractDetails(payload);
      const message = this.extractMessage(payload, exception.message);

      return {
        statusCode,
        code: statusCode === HttpStatus.BAD_REQUEST ? 'VALIDATION_ERROR' : 'HTTP_ERROR',
        message,
        details,
        requestId,
        timestamp,
        path,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor',
      details: [],
      requestId,
      timestamp,
      path,
    };
  }

  private extractMessage(payload: unknown, fallback: string): string {
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const message = (payload as { message: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }

    return fallback;
  }

  private extractDetails(payload: unknown): unknown[] {
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const message = (payload as { message: unknown }).message;
      return Array.isArray(message) ? message : [];
    }

    return [];
  }
}
