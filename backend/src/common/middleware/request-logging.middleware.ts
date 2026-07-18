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
  return rawPath
    .split('/')
    .map((segment) => normalizePathSegment(decodeSegment(segment)))
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/(.)\/$/, '$1');
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

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function normalizePathSegment(segment: string): string {
  if (segment === '') return '';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment))
    return ':id';
  if (/^\d+$/.test(segment)) return ':id';
  if (/^[^@/\s]+@[^@/\s]+\.[^@/\s]+$/.test(segment)) return ':email';
  if (/^\+?\d[\d .()-]{7,}\d$/.test(segment)) return ':phone';
  if (/^[A-Za-z0-9_-]{24,}$/.test(segment)) return ':token';
  if (/^[0-9a-f]{24,}$/i.test(segment)) return ':token';
  return segment;
}
