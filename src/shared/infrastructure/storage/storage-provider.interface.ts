import 'multer';
export interface IStorageProvider {
  upload(file: Express.Multer.File, folder: string, customName?: string): Promise<string>;
  delete(fileUrl: string): Promise<void>;
  deleteByPrefix(prefix: string): Promise<void>;
}
