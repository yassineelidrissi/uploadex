import { diskStorage, FileFilterCallback, Options } from 'multer';
import { extname } from 'path';
import { Request } from 'express';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import * as fs from 'fs';
import * as path from 'path';

export const multerOptionsFactory = async (config: UploadModuleOptions): Promise<Options> => {

    const relativeUploadPath = (config.config as any).uploadPath || './uploads-files';
    const uploadPath = path.resolve(process.cwd(), relativeUploadPath)
    const maxFileSize = config.maxFileSize || 5 * 1024 * 1024;
    const maxFiles = config.maxFiles || 10;
    const allowedMimes = config.allowedMimeTypes || [];

    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }

    return {
        storage: diskStorage({
            destination: (req, file, cb) => {
                try {
                    if (!fs.existsSync(uploadPath)) {
                        fs.mkdirSync(uploadPath, { recursive: true });
                    }
                    cb(null, uploadPath);
                } catch (err) {
                    cb(err, uploadPath);
                }
            },
            filename: (req: Request, file: Express.Multer.File, cb) => {
                const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
            },
        }),
        limits: {
            fileSize: maxFileSize,
            files: maxFiles,
        },
        fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
            if (allowedMimes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(new Error(`Invalid MIME type: ${file.mimetype}`));
            }
        },
    };
};