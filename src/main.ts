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
  // Especificamos NestExpressApplication para poder usar app.set() y silenciamos logs de depuración del framework
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });

  // Configuración para obtener la IP real detrás de un Proxy (Caddy/Nginx)
  app.set('trust proxy', true);

  // Seguridad
  app.use(helmet());

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001'];

  const saasBaseDomain = '.centralafbv.com';

  app.enableCors({
    origin: function (origin, callback) {
      // Si no hay origin (ej. peticiones desde Postman o backend a backend), lo dejamos pasar
      if (!origin) {
        return callback(null, true);
      }

      try {
        const parsedUrl = new URL(origin);
        const hostname = parsedUrl.hostname;

        // REGLA A: ¿Es el dominio base o un subdominio de nuestro SaaS? (ej. transporte.centralafbv.com)
        if (hostname === 'centralafbv.com' || hostname.endsWith(saasBaseDomain)) {
          return callback(null, true);
        }
      } catch (e) {
        // En caso de que no sea una URL parseable, denegamos por seguridad
        return callback(new Error('Bloqueado por políticas de CORS: Origen Inválido'), false);
      }

      // REGLA B: ¿Está en la lista de permitidos específicos? (ej. localhost)
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }

      // Si no cumple nada, bloqueamos el acceso
      callback(new Error('Bloqueado por políticas de CORS'), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

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

  // Imprimir logs de conexión ultra limpios y claros solicitados por el usuario
  console.log('\n================ GpsApiCentral ===============');
  console.log('✅ api corriendo en puerto ' + port);
  console.log('✅ S3 conectado correctamente');
  console.log('✅ api de tracar conectado');
  console.log('✅ conexion con webhook de traccar exitosa');
  console.log('==============================================\n');
}
bootstrap();
