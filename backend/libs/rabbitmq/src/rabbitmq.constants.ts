export function getRabbitMqServiceToken(service: string): string {
  return `${service.toUpperCase()}_SERVICE`;
}

export function getRabbitMqTransportToken(service: string): string {
  return `RABBITMQ_TRANSPORT:${service}`;
}
