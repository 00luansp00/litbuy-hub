import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

const nodeEnvironments = ['development', 'test', 'production'] as const;
const logLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export class EnvironmentVariables {
  @IsIn(nodeEnvironments)
  NODE_ENV!: (typeof nodeEnvironments)[number];

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  API_PREFIX!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false, protocols: ['redis', 'rediss'] })
  REDIS_URL!: string;

  @IsString()
  CORS_ORIGINS!: string;

  @IsIn(logLevels)
  LOG_LEVEL!: (typeof logLevels)[number];

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  SWAGGER_ENABLED!: boolean;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    whitelist: true,
    forbidNonWhitelisted: false,
  });

  if (errors.length > 0) {
    const details = errors.map((error) => ({
      property: error.property,
      constraints: error.constraints ?? {},
    }));
    throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
  }

  return validated;
}
