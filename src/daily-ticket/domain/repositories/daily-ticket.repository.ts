import { Result } from 'neverthrow';
import { DailyTicketEntity } from '../entities/daily-ticket.entity';
import { DailyRoundEntity } from '../entities/daily-round.entity';
import { AppError } from '@shared/domain/errors/app-errors';

export interface DailyTicketRepository {
  save(ticket: DailyTicketEntity): Promise<Result<DailyTicketEntity, AppError>>;
  findByVehicleAndDate(vehicleId: string, workDate: string): Promise<Result<DailyTicketEntity | null, AppError>>;
  findActiveByVehicle(vehicleId: string, date: string): Promise<Result<DailyTicketEntity | null, AppError>>;
  findById(id: string): Promise<Result<DailyTicketEntity, AppError>>;
  saveRound(round: DailyRoundEntity): Promise<Result<DailyRoundEntity, AppError>>;
  findByTenantAndDate(tenantId: string, date: string): Promise<Result<DailyTicketEntity[], AppError>>;
  findByDriverAndDate(driverId: string, workDate: string): Promise<Result<DailyTicketEntity | null, AppError>>;
}
