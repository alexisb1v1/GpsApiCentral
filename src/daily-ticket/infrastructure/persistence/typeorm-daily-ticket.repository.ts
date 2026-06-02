import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result, ok, err } from 'neverthrow';
import { DailyTicketEntity } from '../../domain/entities/daily-ticket.entity';
import { DailyRoundEntity } from '../../domain/entities/daily-round.entity';
import { DailyTicketRepository } from '../../domain/repositories/daily-ticket.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmDailyTicketRepository implements DailyTicketRepository {
  constructor(
    @InjectRepository(DailyTicketEntity)
    private readonly repository: Repository<DailyTicketEntity>,
    @InjectRepository(DailyRoundEntity)
    private readonly roundRepository: Repository<DailyRoundEntity>,
  ) {}

  async save(ticket: DailyTicketEntity): Promise<Result<DailyTicketEntity, AppError>> {
    try {
      const saved = await this.repository.save(ticket);
      return ok(saved);
    } catch (error) {
      console.error('Error saving daily ticket:', error);
      return err('INTERNAL_ERROR');
    }
  }

  async findByVehicleAndDate(vehicleId: string, workDate: string): Promise<Result<DailyTicketEntity | null, AppError>> {
    try {
      const ticket = await this.repository.findOne({ 
        where: { 
          vehicleId, 
          workDate: workDate as any 
        } 
      });
      return ok(ticket);
    } catch (error) {
      console.error('Error finding daily ticket:', error);
      return err('INTERNAL_ERROR');
    }
  }

  async findActiveByVehicle(vehicleId: string, date: string): Promise<Result<DailyTicketEntity | null, AppError>> {
    try {
      const ticket = await this.repository.findOne({ 
        where: { 
          vehicleId, 
          workDate: date as any,
          status: 'ACTIVE' as any
        } 
      });
      return ok(ticket);
    } catch (error) {
      return err('INTERNAL_ERROR');
    }
  }

  async findById(id: string): Promise<Result<DailyTicketEntity, AppError>> {
    try {
      const ticket = await this.repository.findOne({ where: { id } });
      if (!ticket) return err('NOT_FOUND');
      return ok(ticket);
    } catch (error) {
      console.error('Error finding daily ticket by id:', error);
      return err('INTERNAL_ERROR');
    }
  }

  async saveRound(round: DailyRoundEntity): Promise<Result<DailyRoundEntity, AppError>> {
    try {
      const saved = await this.roundRepository.save(round);
      return ok(saved);
    } catch (error) {
      console.error('Error saving daily round:', error);
      return err('INTERNAL_ERROR');
    }
  }

  async findByTenantAndDate(tenantId: string, date: string): Promise<Result<DailyTicketEntity[], AppError>> {
    try {
      const tickets = await this.repository.createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.vehicle', 'vehicle')
        .leftJoinAndSelect('ticket.driver', 'driver')
        .leftJoinAndSelect('ticket.rounds', 'rounds')
        .where('ticket.tenantId = :tenantId', { tenantId })
        .andWhere('ticket.workDate = :date', { date })
        .orderBy('ticket.createdAt', 'DESC')
        .getMany();
      return ok(tickets);
    } catch (error) {
      console.error('Error finding tickets by tenant and date:', error);
      return err('INTERNAL_ERROR');
    }
  }

  async findByDriverAndDate(driverId: string, workDate: string): Promise<Result<DailyTicketEntity | null, AppError>> {
    try {
      const ticket = await this.repository.findOne({
        where: {
          driverId,
          workDate: workDate as any
        }
      });
      return ok(ticket);
    } catch (error) {
      console.error('Error finding daily ticket by driver and date:', error);
      return err('INTERNAL_ERROR');
    }
  }
}
