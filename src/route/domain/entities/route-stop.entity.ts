import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { RouteEntity } from './route.entity';

@Entity('route_stops')
@Unique(['routeId', 'stopOrder', 'direction'])
export class RouteStopEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @Column({ name: 'traccar_geofence_id', type: 'int' })
  traccarGeofenceId: number;

  @Column({ name: 'type', type: 'varchar', length: 50, default: 'CHECKPOINT' })
  type: 'START' | 'CHECKPOINT' | 'END';

  @Column({ name: 'stop_order', type: 'int' })
  stopOrder: number;

  @Column({ name: 'minutes_from_start', type: 'int' })
  minutesFromStart: number;

  @Column({ name: 'direction', type: 'varchar', length: 10, default: 'IDA' })
  direction: 'IDA' | 'VUELTA';

  @Column({ name: 'name', type: 'varchar', length: 100, nullable: true })
  name?: string;

  @Column({ name: 'coordinates', type: 'jsonb', nullable: true })
  coordinates?: { lat: number; lng: number }[];

  @ManyToOne(() => RouteEntity, (route) => route.stops, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: RouteEntity;
}
