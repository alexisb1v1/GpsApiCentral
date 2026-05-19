import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ok, err, Result } from 'neverthrow';
import { ITraccarProvider, TraccarGeofence } from './traccar-provider.interface';

@Injectable()
export class TraccarProvider implements ITraccarProvider {
  private readonly logger = new Logger(TraccarProvider.name);
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('TRACCAR_URL') || 'http://localhost:8082';
    this.authHeader = this.configService.get<string>('TRACCAR_AUTHORIZATION') || '';
    this.logger.log(`Traccar Provider inicializado con URL: ${this.baseUrl}`);
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': this.authHeader,
    };
  }

  async createGeofence(geofence: TraccarGeofence): Promise<Result<TraccarGeofence, Error>> {
    const url = `${this.baseUrl}/api/geofences`;
    this.logger.log(`Creando geocerca en Traccar: "${geofence.name}"`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(geofence),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Error de Traccar al crear geocerca: Estado ${response.status} - ${text}`);
        return err(new Error(`Traccar API error [${response.status}]: ${text || 'Desconocido'}`));
      }

      const data = (await response.json()) as TraccarGeofence;
      this.logger.log(`Geocerca creada con éxito en Traccar. ID asignado: ${data.id}`);
      return ok(data);

    } catch (error: any) {
      this.logger.error(`Excepción crítica al crear geocerca en Traccar: ${error.message}`);
      return err(new Error(`Excepción en conector Traccar: ${error.message}`));
    }
  }

  async updateGeofence(id: number, geofence: TraccarGeofence): Promise<Result<TraccarGeofence, Error>> {
    const url = `${this.baseUrl}/api/geofences/${id}`;
    this.logger.log(`Actualizando geocerca en Traccar. ID: ${id}, Nombre: "${geofence.name}"`);

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ ...geofence, id }),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Error de Traccar al actualizar geocerca ${id}: Estado ${response.status} - ${text}`);
        return err(new Error(`Traccar API error [${response.status}]: ${text || 'Desconocido'}`));
      }

      const data = (await response.json()) as TraccarGeofence;
      this.logger.log(`Geocerca ID ${id} actualizada con éxito en Traccar`);
      return ok(data);

    } catch (error: any) {
      this.logger.error(`Excepción crítica al actualizar geocerca en Traccar: ${error.message}`);
      return err(new Error(`Excepción en conector Traccar: ${error.message}`));
    }
  }

  async deleteGeofence(id: number): Promise<Result<void, Error>> {
    const url = `${this.baseUrl}/api/geofences/${id}`;
    this.logger.log(`Eliminando geocerca de Traccar. ID: ${id}`);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok && response.status !== 204) {
        const text = await response.text();
        this.logger.error(`Error de Traccar al eliminar geocerca ${id}: Estado ${response.status} - ${text}`);
        return err(new Error(`Traccar API error [${response.status}]: ${text || 'Desconocido'}`));
      }

      this.logger.log(`Geocerca ID ${id} eliminada con éxito de Traccar`);
      return ok(undefined);

    } catch (error: any) {
      this.logger.error(`Excepción crítica al eliminar geocerca en Traccar: ${error.message}`);
      return err(new Error(`Excepción en conector Traccar: ${error.message}`));
    }
  }

  async getGeofences(): Promise<Result<TraccarGeofence[], Error>> {
    const url = `${this.baseUrl}/api/geofences`;
    this.logger.log(`Obteniendo todas las geocercas de Traccar...`);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`Error de Traccar al obtener geocercas: Estado ${response.status} - ${text}`);
        return err(new Error(`Traccar API error [${response.status}]: ${text || 'Desconocido'}`));
      }

      const data = (await response.json()) as TraccarGeofence[];
      this.logger.log(`Obtenidas ${data.length} geocercas con éxito de Traccar`);
      return ok(data);

    } catch (error: any) {
      this.logger.error(`Excepción crítica al obtener geocercas en Traccar: ${error.message}`);
      return err(new Error(`Excepción en conector Traccar: ${error.message}`));
    }
  }
}
