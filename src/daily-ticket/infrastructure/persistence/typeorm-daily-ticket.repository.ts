import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result, ok, err } from 'neverthrow';
import { DailyTicketEntity } from '../../domain/entities/daily-ticket.entity';
import { DailyTicketRepository } from '../../domain/repositories/daily-ticket.repository';
import { AppError } from '@shared/domain/errors/app-errors';

@Injectable()
export class TypeOrmDailyTicketRepository implements DailyTicketRepository {
  constructor(
    @InjectRepository(DailyTicketEntity)
    private readonly repository: Repository<DailyTicketEntity>,
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
}
