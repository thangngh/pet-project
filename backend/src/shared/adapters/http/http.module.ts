import { Module } from '@nestjs/common';
import { HttpModule as NestHttpModule } from '@nestjs/axios';

@Module({
  imports: [
    NestHttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
  ],
  exports: [NestHttpModule],
})
export class HttpModule {}
