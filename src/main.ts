// Must be the first import: ConfigModule.forRoot() only runs once AppModule's
// decorator is evaluated, which is *after* every feature module (and therefore
// jwt.constants.ts) has already been imported and read process.env. Loading
// dotenv here makes .env available before any of that happens.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // Automatically transform payloads to DTO instances
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transformOptions: {
        enableImplicitConversion: true, // Automatically convert types (string to number, etc.)
      },
    }),
  );

  app.enableCors({
    origin: '*',
  });

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
