import { Module } from '@nestjs/common';
import { UploadsModule } from './lib/uploads.module';
import { ConfigModule } from '@nestjs/config';
import uploadConfig from './lib/config/upload.config';
import environmentsValidation from './lib/config/environments.validation';

const ENV = process.env.NODE_ENV;

@Module({
  imports: [UploadsModule, ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: !ENV ? '.env' : `.env.${ENV}`,
    load: [uploadConfig],
    validationSchema: environmentsValidation,
  })],
})
export class AppModule {}
