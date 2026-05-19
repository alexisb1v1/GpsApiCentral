import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Result, ok, err } from 'neverthrow';
import { Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateDriverCommand } from '../create-driver.command';
import { UserRepository } from '@user/domain/repositories/user.repository';
import { UserEntity } from '@user/domain/entities/user.entity';
import { DriverInfoEntity } from '@driver/domain/entities/driver-info.entity';
import { DriverInfoRepository } from '@driver/domain/repositories/driver-info.repository';
import { TenantRepository } from '@tenant/domain/repositories/tenant.repository';
import { AppError } from '@shared/domain/errors/app-errors';
import { AuditService } from '@shared/application/services/audit.service';

@CommandHandler(CreateDriverCommand)
export class CreateDriverHandler implements ICommandHandler<CreateDriverCommand> {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('DriverInfoRepository')
    private readonly driverInfoRepository: DriverInfoRepository,
    @Inject('TenantRepository')
    private readonly tenantRepository: TenantRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: CreateDriverCommand): Promise<Result<UserEntity, AppError>> {
    // 1. Validar que no exista ya un chofer con este DNI para este Tenant (Primera validación obligatoria)
    const existingDriverInTenant = await this.userRepository.findByDniAndTenantId(command.dni, command.tenantId);
    if (existingDriverInTenant.isOk()) {
      return err('ALREADY_EXISTS');
    }

    // 2. Validar que el Tenant exista y obtener su subdomain
    const tenantResult = await this.tenantRepository.findById(command.tenantId);
    if (tenantResult.isErr()) {
      return err('NOT_FOUND');
    }
    const tenant = tenantResult.value;

    // 3. Validar que el DNI no esté duplicado globalmente en driver_info
    const existingDni = await this.driverInfoRepository.findByDni(command.dni);
    if (existingDni.isOk()) {
      return err('ALREADY_EXISTS');
    }

    // 4. Validar que el número de licencia no esté duplicado
    const existingLicense = await this.driverInfoRepository.findByLicenseNumber(command.licenseNumber);
    if (existingLicense.isOk()) {
      return err('ALREADY_EXISTS');
    }

    // 5. Generar el correo automático con formato {dni}@{subdomain}.com
    const email = `${command.dni}@${tenant.subdomain}.com`.toLowerCase();
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser.isOk()) {
      return err('ALREADY_EXISTS');
    }

    // 6. Hashear la contraseña inicial (que será el número de DNI)
    const hashedPassword = await bcrypt.hash(command.dni, 10);

    // 6. Crear la cuenta de usuario con rol DRIVER
    const newUser = new UserEntity();
    newUser.tenantId = command.tenantId;
    newUser.name = command.name;
    newUser.email = email;
    newUser.role = 'DRIVER';
    newUser.password = hashedPassword;

    const userSaveResult = await this.userRepository.save(newUser);
    if (userSaveResult.isErr()) {
      return err(userSaveResult.error);
    }
    const savedUser = userSaveResult.value;

    // 7. Crear el registro de DriverInfo y vincularlo al usuario creado
    const newDriverInfo = new DriverInfoEntity();
    newDriverInfo.userId = savedUser.id;
    newDriverInfo.licenseNumber = command.licenseNumber;
    newDriverInfo.licenseExpiry = new Date(command.licenseExpiry);
    newDriverInfo.dni = command.dni;
    newDriverInfo.phoneEmergency = command.phoneEmergency || null;

    const driverInfoSaveResult = await this.driverInfoRepository.save(newDriverInfo);
    if (driverInfoSaveResult.isErr()) {
      return err(driverInfoSaveResult.error);
    }

    // Volvemos a vincular para la respuesta
    savedUser.driverInfo = driverInfoSaveResult.value;

    // 8. Loggear acción en auditoría
    this.auditService.createLog({
      tenantId: savedUser.tenantId,
      userId: command.userId,
      action: 'CREATE_DRIVER',
      entityName: 'driver_info',
      entityId: newDriverInfo.id,
      newValues: {
        userId: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        dni: newDriverInfo.dni,
        licenseNumber: newDriverInfo.licenseNumber,
      },
      ipAddress: command.ipAddress,
      userAgent: command.userAgent,
    });

    return ok(savedUser);
  }
}
