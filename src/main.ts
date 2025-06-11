import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UploadexExceptionFilter } from './lib/errors/uploadex-exception-filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new UploadexExceptionFilter());

  await app.listen(process.env.PORT ?? 5000);

}
bootstrap();
