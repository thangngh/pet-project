import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestIdentity } from './request-context.types';

export interface RequestContextStore {
  requestId: string;
  correlationId: string;
  identity?: RequestIdentity;
}

@Injectable()
export class RequestContextService {
  private readonly als = new AsyncLocalStorage<RequestContextStore>();

  run(store: RequestContextStore, callback: () => void): void {
    this.als.run(store, callback);
  }

  get(): RequestContextStore | undefined {
    return this.als.getStore();
  }

  getRequestId(): string | undefined {
    return this.als.getStore()?.requestId;
  }

  getCorrelationId(): string | undefined {
    return this.als.getStore()?.correlationId;
  }

  getIdentity(): RequestIdentity | undefined {
    return this.als.getStore()?.identity;
  }

  setIdentity(identity: RequestIdentity): void {
    const store = this.als.getStore();
    if (store) {
      store.identity = identity;
    }
  }
}
