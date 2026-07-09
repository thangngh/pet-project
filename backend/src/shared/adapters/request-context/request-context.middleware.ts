import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RequestContextService, RequestContextStore } from './request-context.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const store: RequestContextStore = {
      requestId: (req.headers['x-request-id'] as string) || uuidv4(),
      correlationId: (req.headers['x-correlation-id'] as string) || uuidv4(),
    };

    this.requestContextService.run(store, () => {
      next();
    });
  }
}
