import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { AmqplibInstrumentation } from '@opentelemetry/instrumentation-amqplib';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { NodeSDK } from '@opentelemetry/sdk-node';

const IGNORED_INCOMING_PATHS = new Set([
  '/health/live',
  '/health/ready',
  '/metrics',
]);

let sdk: NodeSDK | undefined;

export const startTracing = (serviceName: string): NodeSDK => {
  const traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      'http://localhost:4318/v1/traces',
  });

  sdk = new NodeSDK({
    serviceName,
    traceExporter,
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (request) => {
          const path = request.url?.split('?')[0] ?? '';
          return IGNORED_INCOMING_PATHS.has(path);
        },
      }),
      new PgInstrumentation({
        ignoreConnectSpans: true,
        requireParentSpan: true,
      }),
      new RedisInstrumentation(),
      new AmqplibInstrumentation(),
    ],
  });

  sdk.start();

  return sdk;
};

export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();

  sdk = undefined;
}
