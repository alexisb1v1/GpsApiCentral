import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './shared/infrastructure/exceptions/global-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  // Especificamos NestExpressApplication para poder usar app.set()
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configuración para obtener la IP real detrás de un Proxy (Caddy/Nginx)
  app.set('trust proxy', true);

  // Seguridad
  app.use(helmet());
  app.enableCors();

  // Archivos Estáticos
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Prefijo global
  app.setGlobalPrefix('api');

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('GpsApiCentral')
    .setDescription('API Central para la gestión de dispositivos GPS')
    .setVersion('1.0')
    .addBearerAuth() // Añadimos soporte para JWT en Swagger
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Filtro global de excepciones
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Validación global de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`Application is running on: http://localhost:${port}/api`);
}
bootstrap();
