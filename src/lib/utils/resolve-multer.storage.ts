import { diskStorage, StorageEngine } from 'multer';
import { extname, resolve } from 'path';
import * as fs from 'fs';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';

export function resolveMulterStorage(config: UploadModuleOptions): StorageEngine {
    const provider = config.provider;
    const isCloud = ['cloudinary', 's3', 'azure', 'gcs'].includes(provider);

    const getOrCreatePath = (path: string) => {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true });
        }
        return path;
    };

    if (isCloud) {
        const cloudTempPath = resolve(process.cwd(), './uploadex-temp');
        return diskStorage({
            destination: getOrCreatePath(cloudTempPath),
            filename: (req, file, cb) => {
                const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
            },
        });
    }

    const localUploadPath = resolve(process.cwd(), (config.config as any).uploadPath || './uploadex-temp');
    return diskStorage({
        destination: getOrCreatePath(localUploadPath),
        filename: (req, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
    });
}