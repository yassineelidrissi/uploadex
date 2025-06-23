import { Module } from '@nestjs/common';
import { UploadsModule } from './lib/uploads.module';

@Module({
  imports: [UploadsModule],
})
export class AppModule {}
