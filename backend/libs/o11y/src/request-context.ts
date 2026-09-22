import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContextData {
  requestId: string;
}

class RequestContext {
  private readonly storage = new AsyncLocalStorage<RequestContextData>();

  run<T>(requestId: string, callback: () => T): T {
    return this.storage.run({ requestId }, callback);
  }

  getRequestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }
}

export const requestContext = new RequestContext();

export function getRequestId(): string | undefined {
  return requestContext.getRequestId();
}
