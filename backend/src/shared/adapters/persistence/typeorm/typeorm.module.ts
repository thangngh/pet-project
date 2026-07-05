import { Module } from '@nestjs/common';
import { TypeOrmModule as NestTypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    NestTypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('app.database.host'),
        port: configService.get<number>('app.database.port'),
        username: configService.get<string>('app.database.username'),
        password: configService.get<string>('app.database.password'),
        database: configService.get<string>('app.database.database'),
        entities: [__dirname + '/../../../../modules/**/*.entity.ts', __dirname + '/../../../../**/*.entity.ts'],
        autoLoadEntities: true,
        synchronize: configService.get<boolean>('app.database.synchronize', false),
        logging: configService.get<boolean>('app.database.logging', false),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class TypeOrmModule {}
