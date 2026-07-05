import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const port = configService.get<number>('app.port', 3001);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  const corsOrigins = configService.get<string[]>('app.corsOrigins', ['*']);

  // Security headers
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: corsOrigins.includes('*') ? '*' : corsOrigins,
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  await app.listen(port);
  console.log(`Application running on http://localhost:${port}/${apiPrefix}`);
}
bootstrap();
