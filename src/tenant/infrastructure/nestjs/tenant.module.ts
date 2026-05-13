import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { TenantEntity } from '@tenant/domain/entities/tenant.entity';
import { TypeOrmTenantRepository } from '@tenant/infrastructure/persistence/typeorm-tenant.repository';
import { CreateTenantHandler } from '@tenant/application/commands/v1/create-tenant/handlers/create-tenant.handler';
import { UpdateTenantHandler } from '@tenant/application/commands/v1/update-tenant/handlers/update-tenant.handler';
import { SoftDeleteTenantHandler } from '@tenant/application/commands/v1/soft-delete-tenant/handlers/soft-delete-tenant.handler';
import { GetTenantByIdHandler } from '@tenant/application/queries/v1/get-tenant-by-id/handlers/get-tenant-by-id.handler';
import { GetTenantsListHandler } from '@tenant/application/queries/v1/get-tenants-list/handlers/get-tenants-list.handler';
import { GetTenantBrandingHandler } from '@tenant/application/queries/v1/get-tenant-branding/handlers/get-tenant-branding.handler';
import { VerifyTenantDomainHandler } from '@tenant/application/queries/v1/verify-tenant-domain/handlers/verify-tenant-domain.handler';

import { CreateTenantController } from '@tenant/interfaces/http/v1/create-tenant/create-tenant.controller';
import { UpdateTenantController } from '@tenant/interfaces/http/v1/update-tenant/update-tenant.controller';
import { SoftDeleteTenantController } from '@tenant/interfaces/http/v1/soft-delete-tenant/soft-delete-tenant.controller';
import { GetTenantByIdController } from '@tenant/interfaces/http/v1/get-tenant-by-id/get-tenant-by-id.controller';
import { GetTenantsListController } from '@tenant/interfaces/http/v1/get-tenants-list/get-tenants-list.controller';
import { GetTenantBrandingController } from '@tenant/interfaces/http/v1/get-tenant-branding/get-tenant-branding.controller';

const Handlers = [
  CreateTenantHandler,
  UpdateTenantHandler,
  SoftDeleteTenantHandler,
  GetTenantByIdHandler,
  GetTenantsListHandler,
  GetTenantBrandingHandler,
  VerifyTenantDomainHandler,
];

const Repositories = [
  {
    provide: 'TenantRepository',
    useClass: TypeOrmTenantRepository,
  },
];

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantEntity]),
    CqrsModule,
  ],
  controllers: [
    CreateTenantController,
    UpdateTenantController,
    SoftDeleteTenantController,
    GetTenantByIdController,
    GetTenantsListController,
    GetTenantBrandingController,
  ],
  providers: [
    ...Repositories,
    ...Handlers,
  ],
  exports: ['TenantRepository'],
})
export class TenantModule {}
