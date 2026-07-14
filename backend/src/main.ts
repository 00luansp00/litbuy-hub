import 'reflect-metadata';
import compression from 'compression';
import helmet from 'helmet';
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
  app.use(helmet());
  app.use(compression());
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
      .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(appConfig.port);
}

if (require.main === module) {
  void bootstrap();
}
