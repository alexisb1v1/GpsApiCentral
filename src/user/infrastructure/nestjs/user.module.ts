import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from '@user/domain/entities/user.entity';

import { TypeOrmUserRepository } from '@user/infrastructure/persistence/typeorm-user.repository';
import { TenantModule } from '@tenant/infrastructure/nestjs/tenant.module';
import { JwtStrategy } from './strategies/jwt.strategy';

// Handlers
import { CreateUserHandler } from '@user/application/commands/v1/create-user/handlers/create-user.handler';
import { UpdateUserHandler } from '@user/application/commands/v1/update-user/handlers/update-user.handler';
import { SoftDeleteUserHandler } from '@user/application/commands/v1/soft-delete-user/handlers/soft-delete-user.handler';
import { LoginHandler } from '@user/application/commands/v1/login/handlers/login.handler';
import { ResetPasswordHandler } from '@user/application/commands/v1/reset-password/handlers/reset-password.handler';
import { ChangePasswordHandler } from '@user/application/commands/v1/change-password/handlers/change-password.handler';
import { GetUserByIdHandler } from '@user/application/queries/v1/get-user-by-id/handlers/get-user-by-id.handler';
import { GetUsersByTenantHandler } from '@user/application/queries/v1/get-users-by-tenant/handlers/get-users-by-tenant.handler';

// Controllers
import { CreateUserController } from '@user/interfaces/http/v1/create-user/create-user.controller';
import { UpdateUserController } from '@user/interfaces/http/v1/update-user/update-user.controller';
import { SoftDeleteUserController } from '@user/interfaces/http/v1/soft-delete-user/soft-delete-user.controller';
import { GetUserByIdController } from '@user/interfaces/http/v1/get-user-by-id/get-user-by-id.controller';
import { GetUsersByTenantController } from '@user/interfaces/http/v1/get-users-by-tenant/get-users-by-tenant.controller';
import { LoginController } from '@user/interfaces/http/v1/login/login.controller';
import { ResetPasswordController } from '@user/interfaces/http/v1/reset-password/reset-password.controller';
import { ChangePasswordController } from '@user/interfaces/http/v1/change-password/change-password.controller';

const Handlers = [
  CreateUserHandler,
  UpdateUserHandler,
  SoftDeleteUserHandler,
  LoginHandler,
  ResetPasswordHandler,
  ChangePasswordHandler,
  GetUserByIdHandler,
  GetUsersByTenantHandler,
];

const Repositories = [
  {
    provide: 'UserRepository',
    useClass: TypeOrmUserRepository,
  },
];

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    CqrsModule,
    TenantModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: configService.get<string>('JWT_EXPIRATION', '24h') as any },
      }),
    }),
  ],
  controllers: [
    CreateUserController,
    UpdateUserController,
    SoftDeleteUserController,
    GetUsersByTenantController,   // ← primero: ruta específica /users/tenant
    GetUserByIdController,        // ← después: wildcard /users/:id
    LoginController,
    ResetPasswordController,
    ChangePasswordController,
  ],
  providers: [
    ...Repositories,
    ...Handlers,
    JwtStrategy,
  ],
  exports: ['UserRepository'],
})
export class UserModule {}
