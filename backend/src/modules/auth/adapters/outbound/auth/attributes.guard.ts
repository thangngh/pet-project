import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RequestIdentity } from '../../../application/ports/auth-middleware.port';

export const ATTRIBUTES_KEY = 'attributes';

@Injectable()
export class AttributesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.configService.get<boolean>('app.features.abac')) {
      return true;
    }

    const required =
      this.reflector.get<Record<string, any>>(ATTRIBUTES_KEY, context.getHandler()) || {};

    if (Object.keys(required).length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const identity: RequestIdentity = request.identity || request.user;

    if (!identity) return false;

    return Object.entries(required).every(
      ([key, value]) => identity.attributes?.[key] === value,
    );
  }
}
