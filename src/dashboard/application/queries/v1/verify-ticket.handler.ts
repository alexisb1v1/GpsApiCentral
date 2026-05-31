/* src/dashboard/application/queries/v1/verify-ticket.handler.ts */
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerifyTicketQuery } from './verify-ticket.query';
import { DailyTicketEntity } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { InfractionEntity } from '@infraction/domain/entities/infraction.entity';
import { PaymentEntity } from '../../../../payment/domain/entities/payment.entity';

@QueryHandler(VerifyTicketQuery)
export class VerifyTicketHandler implements IQueryHandler<VerifyTicketQuery> {
  constructor(
    @InjectRepository(DailyTicketEntity)
    private readonly ticketRepository: Repository<DailyTicketEntity>,
    @InjectRepository(InfractionEntity)
    private readonly infractionRepository: Repository<InfractionEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
  ) {}

  async execute(query: VerifyTicketQuery): Promise<any> {
    const { code } = query;
    if (!code) {
      return { success: false, message: 'Código de ticket no proporcionado.' };
    }

    const cleanCode = code.trim().toUpperCase();

    // 1. Intentar validar si es un ticket de salida (DailyTicket)
    // Puede buscar por número de ticket exacto (ej. TK-A3F8B) o ID de base de datos
    const ticket = await this.ticketRepository.findOne({
      where: [
        { ticketNumber: cleanCode },
        { id: cleanCode.replace('TK-', '') } // Manejar formato alternativo
      ],
      relations: ['vehicle', 'driver', 'rounds', 'tenant']
    });

    if (ticket) {
      return {
        success: true,
        type: 'SALIDA',
        ticketNumber: ticket.ticketNumber,
        dateTime: ticket.createdAt,
        vehiclePlate: ticket.vehicle?.plate || 'S/P',
        vehicleNumber: (ticket.vehicle as any)?.number || null,
        driverName: ticket.driver ? ticket.driver.name : 'No asignado',
        routeName: 'Control de Salida / Despacho',
        status: ticket.status,
        items: [
          { label: 'Tasa de Administración', value: Number(ticket.adminFee) },
          { label: 'Uso de Ruta', value: Number(ticket.routeFee) },
        ],
        totalAmount: Number(ticket.totalAmount),
        paymentMethod: 'EFECTIVO',
        tenantName: ticket.tenant?.name || 'Vectura',
        primaryColor: ticket.tenant?.primaryColor || '#0052cc',
        accentColor: ticket.tenant?.accentColor || '#0047cc',
      };
    }

    // 2. Si no es un ticket de salida, intentar validar si es un recibo consolidado de caja (Payment)
    // Busca por número de pago exacto (ej. PAG-000104) o por su ID
    const payment = await this.paymentRepository.findOne({
      where: [
        { paymentNumber: cleanCode },
        { id: cleanCode.replace('PAG-', '') } // Manejar formato alternativo
      ],
      relations: ['tenant', 'dailyTicket', 'dailyTicket.driver']
    });

    if (payment) {
      // Buscar las infracciones asociadas a este cobro de caja
      const infractions = await this.infractionRepository.find({
        where: { paymentId: payment.id },
        relations: ['vehicle']
      });

      const items = infractions.map(inf => {
        const sanCode = `#SAN-${inf.id.substring(0, 5).toUpperCase()}`;
        return {
          label: `${sanCode} - Sanción por ${this.getInfractionLabel(inf.type)}`,
          value: Number(inf.amount),
        };
      });

      // Determinar placa del vehículo
      const vehiclePlate = infractions[0]?.vehicle?.plate || payment.dailyTicket?.vehicle?.plate || 'S/P';

      return {
        success: true,
        type: 'SANCION',
        ticketNumber: payment.paymentNumber || `REC-${payment.id.substring(0, 5).toUpperCase()}`,
        dateTime: payment.createdAt,
        vehiclePlate: vehiclePlate,
        driverName: payment.dailyTicket?.driver ? payment.dailyTicket.driver.name : 'No asignado',
        routeName: 'Recaudación de Caja Consolidada',
        status: 'PAID',
        items: items.length > 0 ? items : [{ label: 'Abono General de Caja', value: Number(payment.amount) }],
        totalAmount: Number(payment.amount),
        paymentMethod: payment.paymentMethod,
        tenantName: payment.tenant?.name || 'Vectura',
        primaryColor: payment.tenant?.primaryColor || '#0052cc',
        accentColor: payment.tenant?.accentColor || '#0047cc',
      };
    }

    // 3. Si no coincide con ninguno, reportar error
    return {
      success: false,
      message: `El comprobante o ticket "${cleanCode}" no existe en el sistema de transporte de Vectura.`
    };
  }

  private getInfractionLabel(type: string) {
    switch (type) {
      case 'PIRATERIA':
        return 'Piratería o Desvío';
      case 'EVASION_PAGO':
        return 'Evasión de Pago';
      case 'RETRASO_RUTA':
        return 'Retraso de Horario';
      default:
        return type;
    }
  }
}
