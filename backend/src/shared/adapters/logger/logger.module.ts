import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        transports: [
          new winston.transports.Console({
            level: configService.get('app.logging.level', 'info'),
            format: winston.format.combine(
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              winston.format.errors({ stack: true }),
              winston.format.printf(({ timestamp, level, message, context, trace, ...meta }) => {
                const ctx = context ? `[${context}]` : '';
                const traceStr = trace ? `\n${trace}` : '';
                const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} ${level.toUpperCase()} ${ctx} ${message}${metaStr}${traceStr}`;
              }),
            ),
          }),
        ],
      }),
      inject: [ConfigService],
    }),
  ],
})
export class LoggerModule {}
