import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { RouteEntity } from './route.entity';
import { GeofenceEntity } from '@geofence/domain/entities/geofence.entity';

@Entity('route_stops')
@Unique(['routeId', 'stopOrder'])
export class RouteStopEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @Column({ name: 'geofence_id', type: 'uuid' })
  geofenceId: string;

  @Column({ name: 'stop_order', type: 'int' })
  stopOrder: number;

  @Column({ name: 'minutes_from_start', type: 'int' })
  minutesFromStart: number;

  @ManyToOne(() => RouteEntity, (route) => route.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: RouteEntity;

  @ManyToOne(() => GeofenceEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'geofence_id' })
  geofence: GeofenceEntity;
}
