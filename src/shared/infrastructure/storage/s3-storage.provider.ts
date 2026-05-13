import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { IStorageProvider } from './storage-provider.interface';
import { extname } from 'path';

@Injectable()
export class S3StorageProvider implements IStorageProvider {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly logger = new Logger(S3StorageProvider.name);

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
    this.logger.log(`S3 Client inicializado en región: ${this.region} para el bucket: ${this.bucketName}`);
  }

  async upload(file: Express.Multer.File, folder: string, customName?: string): Promise<string> {
    const extension = extname(file.originalname);
    const fileName = customName ? `${customName}${extension}` : `${Date.now()}-${file.originalname}`;
    const key = `${folder}/${fileName}`;

    this.logger.log(`Intentando subir archivo a S3: ${key}`);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);
      
      const publicUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      this.logger.log(`Subida exitosa. URL generada: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      this.logger.error(`Error crítico subiendo archivo a S3: ${error.message}`);
      throw new Error(`No se pudo subir el archivo a S3: ${error.message}`);
    }
  }

  async delete(fileUrl: string): Promise<void> {
    try {
      // Extraer el Key desde la URL
      // Formato esperado: https://bucket.s3.region.amazonaws.com/folder/file.ext
      const urlParts = fileUrl.split('.amazonaws.com/');
      if (urlParts.length < 2) return;
      
      const key = urlParts[1];

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      this.logger.error(`Error eliminando archivo en S3: ${error.message}`);
    }
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    try {
      // Listar objetos que coincidan con el prefijo
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      const listResponse = await this.s3Client.send(listCommand);

      if (!listResponse.Contents || listResponse.Contents.length === 0) return;

      // Borrar todos los objetos encontrados
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: listResponse.Contents.map((content) => ({ Key: content.Key })),
        },
      });

      await this.s3Client.send(deleteCommand);
      this.logger.log(`Limpieza S3 completada para: ${prefix}`);
    } catch (error) {
      this.logger.error(`Error en limpieza S3 por prefijo: ${error.message}`);
    }
  }
}
