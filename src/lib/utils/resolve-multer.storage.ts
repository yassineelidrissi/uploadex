import { diskStorage, memoryStorage, StorageEngine } from 'multer';
import { extname, resolve } from 'path';
import * as fs from 'fs';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';

export function resolveMulterStorage(config: UploadModuleOptions): StorageEngine {
    const provider = config.provider;

    const useMemory = ['cloudinary', 's3', 'azure'].includes(provider);

    if (useMemory) {
        return memoryStorage();
    }

    const uploadPath = resolve(process.cwd(), (config.config as any).uploadPath || './uploads');

    return diskStorage({
        destination: (req, file, cb) => {
            if (!fs.existsSync(uploadPath)) {
              fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
    });
}
