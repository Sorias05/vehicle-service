import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import * as net from 'node:net';

import { HealthCheck, HealthCheckResult } from '../health.types';

@Injectable()
export class RabbitMqHealthCheck implements HealthCheck {
  readonly name = 'rabbitmq' as const;

  constructor(private readonly moduleRef: ModuleRef) {}

  async check(): Promise<HealthCheckResult> {
    try {
      const config = this.moduleRef.get<ConfigService>(ConfigService, {
        strict: false,
      });

      const host = config.getOrThrow<string>('RABBITMQ_HOST');

      const port = Number(config.getOrThrow<string>('RABBITMQ_PORT'));

      await this.checkConnection(host, port);

      return {
        name: this.name,
        status: 'up',
      };
    } catch {
      return {
        name: this.name,
        status: 'down',
        message: 'RabbitMQ is unavailable',
      };
    }
  }

  private checkConnection(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host,
        port,
      });

      socket.setTimeout(2000);

      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });

      socket.once('timeout', () => {
        socket.destroy();
        reject(new Error('RabbitMQ connection timeout'));
      });

      socket.once('error', (error) => {
        socket.destroy();
        reject(error);
      });
    });
  }
}
