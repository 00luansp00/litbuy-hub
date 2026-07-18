import 'reflect-metadata';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AppLogger } from './common/logging/app-logger.service';
import type { AppConfig } from './config/app.config';

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(AppLogger, { strict: false }) ?? new AppLogger();
  app.useLogger(logger);

  const config = app.get(ConfigService);
  const appConfig = config.getOrThrow<AppConfig>('app');

  app.setGlobalPrefix(appConfig.apiPrefix);
  app.enableVersioning({ type: VersioningType.URI });
  app.enableShutdownHooks();
  const httpAdapter = app.getHttpAdapter().getInstance() as Express;
  httpAdapter.disable('x-powered-by');
  httpAdapter.set('trust proxy', appConfig.trustProxy);
  httpAdapter.set('json spaces', 0);
  httpAdapter.use((req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(appConfig.requestTimeoutMs);
    res.setTimeout(appConfig.requestTimeoutMs);
    next();
  });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ limit: '64kb', extended: false }));
  app.enableCors({
    origin: appConfig.corsOrigins.length > 0 ? appConfig.corsOrigins : false,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  if (appConfig.swaggerEnabled) {
    const documentConfig = new DocumentBuilder()
      .setTitle('LIT Buy API')
      .setDescription('API REST do marketplace LIT Buy. Fundação técnica sem domínios comerciais.')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addCookieAuth(appConfig.apiPrefix ? 'litbuy_refresh' : 'litbuy_refresh')
      .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(appConfig.port);
}

if (require.main === module) {
  void bootstrap();
}
