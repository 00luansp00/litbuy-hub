import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppLogger } from '../logging/app-logger.service';
import { redactValue } from '../logging/redaction';

type ExpressRoutePath = string | RegExp | Array<string | RegExp>;

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
        route: normalizeRoute(req),
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

export function normalizeRoute(req: Request): string {
  const routePath = routePathToString(getExpressRoutePath(req));
  if (routePath) return joinPathParts(req.baseUrl, routePath);
  const rawPath = (req.path || req.originalUrl || req.url || '/').split('?')[0] || '/';
  return normalizeUnmatchedRoute(rawPath);
}

function routePathToString(path: ExpressRoutePath | undefined): string | undefined {
  if (typeof path === 'string') return path;
  if (path instanceof RegExp) return undefined;
  if (Array.isArray(path))
    return routePathToString(path.find((entry) => typeof entry === 'string'));
  return undefined;
}

function getExpressRoutePath(req: Request): ExpressRoutePath | undefined {
  const candidate = req as unknown;
  if (!isRecord(candidate) || !isRecord(candidate.route)) return undefined;
  const path = candidate.route.path;
  if (typeof path === 'string' || path instanceof RegExp || isRoutePathArray(path)) return path;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRoutePathArray(value: unknown): value is Array<string | RegExp> {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string' || entry instanceof RegExp)
  );
}

function joinPathParts(baseUrl = '', routePath = ''): string {
  const joined = `/${baseUrl}/${routePath}`.replace(/\/+/g, '/');
  return joined.replace(/(.)\/$/, '$1');
}

const recognizedFallbackPrefixes = [
  ['api', 'v1', 'auth'],
  ['api', 'v1', 'health'],
] as const;

function normalizeUnmatchedRoute(rawPath: string): string {
  const segments = rawPath
    .replace(/[\r\n]/g, '')
    .split('/')
    .filter((segment) => segment !== '');
  const prefix = recognizedFallbackPrefixes.find((candidate) =>
    candidate.every((segment, index) => segments[index] === segment),
  );
  if (!prefix) return '/:unmatched';
  return `/${prefix.join('/')}/:unmatched`;
}
