import 'multer';
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Inject,
  Param,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Public } from '../decorators/public.decorator';
import { IStorageProvider } from './storage-provider.interface';

@ApiTags('Storage')
@Controller('v1/storage')
export class UploadController {
  constructor(
    @Inject('IStorageProvider')
    private readonly storageProvider: IStorageProvider,
  ) {}

  @Post('upload/branding/:taxId/:type')
  @Public()
  @ApiOperation({ summary: 'Subir imagen de branding a S3 organizada por RUC' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return cb(
            new BadRequestException(
              'Solo se permiten imágenes (jpg, png, gif, webp)',
            ),
            false,
          );
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Param('taxId') taxId: string,
    @Param('type') type: string,
  ) {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }

    if (!taxId || !type) {
      throw new BadRequestException('Falta RUC o Tipo de imagen');
    }

    // Limpiamos versiones anteriores para no acumular basura (ej: si cambia de .png a .jpg)
    await this.storageProvider.deleteByPrefix(`${taxId}/${type}`);

    // El folder será el taxId y el nombre del archivo será el tipo (logo o login)
    const fileUrl = await this.storageProvider.upload(file, taxId, type);

    return {
      success: true,
      data: {
        url: fileUrl,
        mimetype: file.mimetype,
        size: file.size,
      },
    };
  }
}
