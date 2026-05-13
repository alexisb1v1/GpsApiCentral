import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IStorageProvider } from './storage-provider.interface';
import { extname, join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readdirSync } from 'fs';
import 'multer';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private readonly uploadPath = join(process.cwd(), 'public', 'uploads');
  private readonly logger = new Logger(LocalStorageProvider.name);

  constructor(private configService: ConfigService) {
    // Asegurarse de que la carpeta base de uploads exista
    if (!existsSync(this.uploadPath)) {
      mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async upload(file: Express.Multer.File, folder: string, customName?: string): Promise<string> {
    const targetFolder = join(this.uploadPath, folder);
    
    // Crear la carpeta del tenant (RUC) si no existe
    if (!existsSync(targetFolder)) {
      mkdirSync(targetFolder, { recursive: true });
    }

    const extension = extname(file.originalname);
    const fileName = customName ? `${customName}${extension}` : `${Date.now()}-${file.originalname}`;
    const filePath = join(targetFolder, fileName);

    try {
      writeFileSync(filePath, file.buffer);
      
      // Devolvemos la URL relativa que el frontend puede consumir
      // Ejemplo: /uploads/20283705472/logo.png
      return `/uploads/${folder}/${fileName}`;
    } catch (error) {
      this.logger.error(`Error guardando archivo local: ${error.message}`);
      throw new Error('No se pudo guardar el archivo en el servidor');
    }
  }

  async delete(fileUrl: string): Promise<void> {
    try {
      // Convertir URL /uploads/xxx a path físico
      const relativePath = fileUrl.replace('/uploads/', '');
      const fullPath = join(this.uploadPath, relativePath);
      
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
      }
    } catch (error) {
      this.logger.error(`Error eliminando archivo local: ${error.message}`);
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      // El prefix viene como "RUC/tipo"
      const [folder, fileNamePrefix] = prefix.split('/');
      const targetFolder = join(this.uploadPath, folder);

      if (!existsSync(targetFolder)) return;

      const files = readdirSync(targetFolder);
      const filesToDelete = files.filter(f => f.startsWith(fileNamePrefix));

      for (const file of filesToDelete) {
        unlinkSync(join(targetFolder, file));
      }
      
      this.logger.log(`Limpieza local completada para: ${prefix}`);
    } catch (error) {
      this.logger.error(`Error en limpieza local por prefijo: ${error.message}`);
    }
  }
}
