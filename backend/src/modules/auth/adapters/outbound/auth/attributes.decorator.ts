import { SetMetadata } from '@nestjs/common';

export const ATTRIBUTES_KEY = 'attributes';
export const Attributes = (attrs: Record<string, any>) => SetMetadata(ATTRIBUTES_KEY, attrs);
