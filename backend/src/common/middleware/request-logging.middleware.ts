import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppLogger } from '../logging/app-logger.service';
import { redactValue } from '../logging/redaction';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: AppLogger) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.logger.log({
        event: 'http_request',
        requestId: req.requestId ?? 'unknown',
        method: req.method,
        route: req.path,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        environment: process.env.NODE_ENV ?? 'development',
        headers: redactValue({
          authorization: req.headers.authorization,
          cookie: req.headers.cookie,
          csrf: req.headers['x-csrf-token'],
        }),
      });
    });
    next();
  }
}
