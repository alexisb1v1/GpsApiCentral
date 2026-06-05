import { Result } from 'neverthrow';

export interface TraccarGeofence {
  id?: number;
  name: string;
  description?: string;
  area: string; // WKT (Well-Known Text) format, e.g., 'POLYGON (...)' or 'CIRCLE (...)'
  attributes?: Record<string, any>;
}

export interface TraccarGroup {
  id?: number;
  name: string;
  parentId?: number;
  attributes?: Record<string, any>;
}

export interface TraccarDevice {
  id?: number;
  name: string;
  uniqueId: string; // IMEI o identificador único del dispositivo GPS / App
  groupId?: number;
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
   * Obtiene todas las geocercas registradas en Traccar, opcionalmente filtradas por grupo.
   */
  getGeofences(groupId?: number): Promise<Result<TraccarGeofence[], Error>>;

  /**
   * Crea un grupo en el servidor de Traccar.
   */
  createGroup(group: TraccarGroup): Promise<Result<TraccarGroup, Error>>;

  /**
   * Vincula una geocerca con un grupo de Traccar (tabla de permisos).
   */
  linkGeofenceToGroup(groupId: number, geofenceId: number): Promise<Result<void, Error>>;

  /**
   * Crea un dispositivo (vehículo GPS) en el servidor de Traccar.
   * @param device - Datos del dispositivo: nombre y uniqueId (IMEI o ID de App)
   */
  createDevice(device: TraccarDevice): Promise<Result<TraccarDevice, Error>>;

  /**
   * Verifica si un dispositivo con el uniqueId dado ya existe en Traccar.
   * @param uniqueId - IMEI o ID único del dispositivo
   * @returns true si ya está registrado, false si está libre
   */
  checkDeviceExists(uniqueId: string): Promise<Result<boolean, Error>>;

  /**
   * Obtiene el historial de posiciones de un dispositivo en un rango de fechas.
   * @param deviceId - ID numérico del dispositivo en Traccar (traccarId)
   * @param from - Fecha de inicio (UTC)
   * @param to - Fecha de fin (UTC)
   */
  getDevicePositions(traccarDeviceId: number, from: Date, to: Date): Promise<Result<any[], Error>>;

  /**
   * Obtiene el historial de eventos de un dispositivo en un rango de fechas.
   * @param traccarDeviceId - ID numérico del dispositivo en Traccar
   * @param from - Fecha de inicio (UTC)
   * @param to - Fecha de fin (UTC)
   */
  getDeviceEvents(traccarDeviceId: number, from: Date, to: Date): Promise<Result<any[], Error>>;

  /**
   * Actualiza un dispositivo en el servidor de Traccar (ej: cambiar el groupId o el nombre).
   */
  updateDevice(id: number, device: TraccarDevice): Promise<Result<TraccarDevice, Error>>;

  /**
   * Elimina físicamente un dispositivo en Traccar por su ID interno.
   */
  deleteDevice(id: number): Promise<Result<void, Error>>;

  /**
   * Elimina un grupo de Traccar por su ID.
   */
  deleteGroup(id: number): Promise<Result<void, Error>>;
}


