import { Result } from 'neverthrow';

export interface TraccarGeofence {
  id?: number;
  name: string;
  description?: string;
  area: string; // WKT (Well-Known Text) format, e.g., 'POLYGON (...)' or 'CIRCLE (...)'
  attributes?: Record<string, any>;
}

export interface ITraccarProvider {
  /**
   * Crea una geocerca en el servidor de Traccar.
   */
  createGeofence(geofence: TraccarGeofence): Promise<Result<TraccarGeofence, Error>>;

  /**
   * Actualiza una geocerca existente en el servidor de Traccar.
   */
  updateGeofence(id: number, geofence: TraccarGeofence): Promise<Result<TraccarGeofence, Error>>;

  /**
   * Elimina una geocerca del servidor de Traccar.
   */
  deleteGeofence(id: number): Promise<Result<void, Error>>;

  /**
   * Obtiene todas las geocercas registradas en Traccar.
   */
  getGeofences(): Promise<Result<TraccarGeofence[], Error>>;
}
