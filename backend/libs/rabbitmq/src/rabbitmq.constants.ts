export function getRabbitMqServiceToken(service: string): string {
  return `${service.toUpperCase()}_SERVICE`;
}
