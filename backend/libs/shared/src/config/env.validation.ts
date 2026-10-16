import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  // RabbitMQ

  @IsOptional()
  @IsString()
  RABBITMQ_USER?: string;

  @IsOptional()
  @IsString()
  RABBITMQ_PASS?: string;

  @IsOptional()
  @IsString()
  RABBITMQ_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  RABBITMQ_PORT?: number;

  // Redis

  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  REDIS_PORT?: number;

  // Session

  @IsOptional()
  @IsString()
  SESSION_SECRET?: string;

  // PostgreSQL

  @IsOptional()
  @IsString()
  POSTGRES_USER?: string;

  @IsOptional()
  @IsString()
  POSTGRES_PASSWORD?: string;

  @IsOptional()
  @IsString()
  POSTGRES_DB?: string;

  @IsOptional()
  @IsString()
  POSTGRES_URI?: string;

  @IsOptional()
  @IsString()
  POSTGRES_URI_LOCAL?: string;

  // S3

  @IsOptional()
  @IsString()
  AWS_REGION?: string;

  @IsOptional()
  @IsString()
  AWS_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  AWS_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  AWS_S3_BUCKET?: string;

  @IsOptional()
  @IsString()
  AWS_S3_ENDPOINT?: string;

  // Storage

  @IsOptional()
  @IsString()
  STORAGE_ALLOWED_CONTENT_TYPES?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  STORAGE_UPLOAD_URL_EXPIRES_IN?: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
