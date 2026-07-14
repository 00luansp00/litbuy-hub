import { ConsoleLogger, Injectable, type LogLevel } from '@nestjs/common';

@Injectable()
export class AppLogger extends ConsoleLogger {
  constructor() {
    super('LitBuyApi', {
      timestamp: true,
      logLevels: AppLogger.resolveLogLevels(process.env.LOG_LEVEL ?? 'info'),
    });
  }

  private static resolveLogLevels(level: string): LogLevel[] {
    const levels: Record<string, LogLevel[]> = {
      fatal: ['fatal'],
      error: ['fatal', 'error'],
      warn: ['fatal', 'error', 'warn'],
      info: ['fatal', 'error', 'warn', 'log'],
      debug: ['fatal', 'error', 'warn', 'log', 'debug'],
      trace: ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'],
      silent: [],
    };

    return levels[level] ?? levels.info;
  }
}
