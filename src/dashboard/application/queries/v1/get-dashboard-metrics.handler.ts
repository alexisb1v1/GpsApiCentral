/* src/dashboard/application/queries/v1/get-dashboard-metrics.handler.ts */
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Not } from 'typeorm';
import { GetDashboardMetricsQuery } from './get-dashboard-metrics.query';
import { VehicleEntity, VehicleStatus } from '@vehicle/domain/entities/vehicle.entity';
import { DailyTicketEntity, TicketStatus } from '@daily-ticket/domain/entities/daily-ticket.entity';
import { InfractionEntity } from '@infraction/domain/entities/infraction.entity';

@QueryHandler(GetDashboardMetricsQuery)
export class GetDashboardMetricsHandler implements IQueryHandler<GetDashboardMetricsQuery> {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
    @InjectRepository(DailyTicketEntity)
    private readonly ticketRepository: Repository<DailyTicketEntity>,
    @InjectRepository(InfractionEntity)
    private readonly infractionRepository: Repository<InfractionEntity>,
  ) {}

  async execute(query: GetDashboardMetricsQuery): Promise<any> {
    const { tenantId } = query;

    // 1. Obtener la fecha de trabajo actual en huso horario local de Lima/Pucallpa
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = formatter.format(new Date()); // Formato YYYY-MM-DD

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 2. Ejecutar consultas paralelas de alto rendimiento para consolidación rápida
    const [
      activeTickets,
      totalVehiclesCount,
      recentAlerts,
      recentTickets
    ] = await Promise.all([
      // A. Cargar todos los tickets activos de hoy del tenant
      this.ticketRepository.find({
        where: {
          tenantId: tenantId,
          workDate: todayStr as any,
          status: TicketStatus.ACTIVE
        },
        relations: ['driver', 'rounds', 'vehicle']
      }),

      // B. Contar el total de vehículos activos/operativos del tenant (no dados de baja)
      this.vehicleRepository.count({
        where: {
          tenantId: tenantId,
          status: Not(VehicleStatus.BAJA)
        }
      }),

      // C. Obtener las últimas 5 infracciones de hoy del tenant
      this.infractionRepository.find({
        where: {
          tenantId: tenantId,
          createdAt: MoreThanOrEqual(todayStart)
        },
        relations: ['vehicle'],
        order: { createdAt: 'DESC' },
        take: 5
      }),

      // D. Obtener los últimos 5 tickets despachados de hoy del tenant para auditoría rápida
      this.ticketRepository.find({
        where: {
          tenantId: tenantId,
          workDate: todayStr as any,
          status: TicketStatus.ACTIVE
        },
        relations: ['driver', 'vehicle'],
        order: { createdAt: 'DESC' },
        take: 5
      })
    ]);

    // 3. Cálculos agregados en memoria
    // Recaudación en Soles de hoy
    const totalRevenueToday = activeTickets.reduce((sum, ticket) => sum + Number(ticket.totalAmount), 0);

    // Unidades en ruta (con ticket activo)
    const vehiclesInRouteCount = activeTickets.length;

    // Unidades pendientes (vehículos operativos sin ticket registrado hoy)
    const vehiclesPendingCount = Math.max(0, totalVehiclesCount - vehiclesInRouteCount);

    // 4. Mapear DTO de monitoreo de paradero dinámico
    const monitoringUnits = recentTickets.map(ticket => {
      const activeRound = ticket.rounds?.find((r: any) => r.status === 'IN_PROGRESS') || ticket.rounds?.[ticket.rounds.length - 1];
      return {
        id: `TK-${ticket.id.substring(0, 5).toUpperCase()}`,
        vehiclePlate: ticket.vehicle?.plate || 'S/P',
        vehicleNumber: (ticket.vehicle as any)?.number || null,
        driverName: ticket.driver ? ticket.driver.name : 'No asignado',
        routeName: 'Control Operativo',
        direction: activeRound ? activeRound.direction : 'IDA',
        dispatchedAt: ticket.createdAt
      };
    });

    // Mapear alertas recientes
    const alerts = recentAlerts.map(inf => ({
      id: `#SAN-${inf.id.substring(0, 5).toUpperCase()}`,
      vehiclePlate: inf.vehicle?.plate || 'S/P',
      type: inf.type,
      amount: Number(inf.amount),
      detail: inf.description || 'Infracción registrada',
      createdAt: inf.createdAt
    }));

    // Mapear últimos tickets consolidados
    const ticketsList = recentTickets.map(ticket => ({
      id: `TK-${ticket.id.substring(0, 5).toUpperCase()}`,
      ticketNumber: `TK-${ticket.id.substring(0, 5).toUpperCase()}`,
      vehiclePlate: ticket.vehicle?.plate || 'S/P',
      totalAmount: Number(ticket.totalAmount),
      dispatchedAt: ticket.createdAt
    }));

    return {
      kpis: {
        totalRevenueToday: totalRevenueToday,
        revenueTrendLabel: '+12.5% vs ayer',
        vehiclesInRouteCount: vehiclesInRouteCount,
        vehiclesPendingCount: vehiclesPendingCount
      },
      monitoringUnits: monitoringUnits,
      recentAlerts: alerts,
      recentTickets: ticketsList
    };
  }
}
