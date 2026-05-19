import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import { UpdateDriverCommand } from '../update-driver.command';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { UserEntity } from '@user/domain/entities/user.entity';
import { DriverInfoEntity } from '@driver/domain/entities/driver-info.entity';
import { DriverInfoRepository } from '@driver/domain/repositories/driver-info.repository';
import { TenantRepository } from '@tenant/domain/repositories/tenant.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';
import { RegisterStatus } from '@shared/domain/enums/register-status.enum';

@CommandHandler(UpdateDriverCommand)
export class UpdateDriverHandler implements ICommandHandler<UpdateDriverCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('DriverInfoRepository')
    private readonly driverInfoRepository: DriverInfoRepository,
    @Inject('TenantRepository')
    private readonly tenantRepository: TenantRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: UpdateDriverCommand): Promise<Result<UserEntity, AppError>> {
    // 1. Buscar el usuario (que es el chofer)
    const userResult = await this.userRepository.findById(command.id);
    if (userResult.isErr()) {
      return err('NOT_FOUND');
    }
    const user = userResult.value;

    // 2. Verificar que tenga el rol de chofer
    if (user.role !== 'DRIVER') {
      return err('INVALID_INPUT');
    }

    const currentDriverInfo = user.driverInfo;

    // 3. Validar DNI si ha cambiado
    if (currentDriverInfo && command.dni !== currentDriverInfo.dni) {
      // Validar DNI + Tenant primero (Unicidad por Tenant)
      const existingDriverInTenant = await this.userRepository.findByDniAndTenantId(command.dni, user.tenantId);
      if (existingDriverInTenant.isOk()) {
        return err('ALREADY_EXISTS');
      }

      // Validar globalmente en driver_info
      const existingDni = await this.driverInfoRepository.findByDni(command.dni);
      if (existingDni.isOk()) {
        return err('ALREADY_EXISTS');
      }
    }

    // 4. Validar número de licencia si ha cambiado
    if (currentDriverInfo && command.licenseNumber !== currentDriverInfo.licenseNumber) {
      const existingLicense = await this.driverInfoRepository.findByLicenseNumber(command.licenseNumber);
      if (existingLicense.isOk()) {
        return err('ALREADY_EXISTS');
      }
    }

    // 5. Actualizar los campos del usuario
    user.name = command.name;
    // Si cambia el DNI, actualizamos su correo de ingreso para mantener la consistencia
    if (currentDriverInfo && command.dni !== currentDriverInfo.dni) {
      const tenantResult = await this.tenantRepository.findById(user.tenantId);
      if (tenantResult.isErr()) {
        return err('NOT_FOUND');
      }
      const tenant = tenantResult.value;
      user.email = `${command.dni}@${tenant.subdomain}.com`.toLowerCase();
    }

    if (command.status) {
      user.status = command.status as RegisterStatus;
    }

    const userSaveResult = await this.userRepository.save(user);
    if (userSaveResult.isErr()) {
      return err(userSaveResult.error);
    }

    // 6. Actualizar o crear DriverInfo
    let driverInfo = currentDriverInfo;
    if (!driverInfo) {
      driverInfo = new DriverInfoEntity();
      driverInfo.userId = user.id;
    }

    driverInfo.licenseNumber = command.licenseNumber;
    driverInfo.licenseExpiry = new Date(command.licenseExpiry);
    driverInfo.dni = command.dni;
    driverInfo.phoneEmergency = command.phoneEmergency || null;
    if (command.status) {
      driverInfo.status = command.status as RegisterStatus;
    }

    const driverInfoSaveResult = await this.driverInfoRepository.save(driverInfo);
    if (driverInfoSaveResult.isErr()) {
      return err(driverInfoSaveResult.error);
    }

    user.driverInfo = driverInfoSaveResult.value;

    // 7. Loggear acción en auditoría
    this.auditService.createLog({
      tenantId: user.tenantId,
      userId: command.userId,
      action: 'UPDATE_DRIVER',
      entityName: 'driver_info',
      entityId: driverInfo.id,
      newValues: {
        userId: user.id,
        name: user.name,
        email: user.email,
        dni: driverInfo.dni,
        licenseNumber: driverInfo.licenseNumber,
        status: driverInfo.status,
      },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(user);
  }
}
