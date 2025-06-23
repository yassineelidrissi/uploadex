import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { UploadConfigStorage } from '../utils/upload-config.storage';
import { resolveMulterStorage } from '../utils/resolve-multer.storage';
import { transformMulterError } from '../helpers/upload-validation.helper';
import { UploadexNestException } from '../errors/uploadex-nest-exceptions';
import { Request } from 'express';
import { extname } from 'path';
import * as multer from 'multer';
import { Observable } from 'rxjs';
import { UploadexError } from '../errors/uploadex-error';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from '../constants/upload.constants';

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = extname(file.originalname).toLowerCase();
    const config = UploadConfigStorage.get();
    const allowedExt = config.allowedExtensions ?? ALLOWED_EXTENSIONS;
    const allowedMime = config.allowedMimeTypes ?? ALLOWED_MIME_TYPES;
  
    if (!allowedExt.includes(ext)) {
      return cb(new UploadexError('INVALID_EXTENSION', `Invalid file extension: ${ext}`, { extension: ext }));
    }
  
    if (!allowedMime.includes(file.mimetype)) {
      return cb(new UploadexError('INVALID_MIME_TYPE', `Invalid MIME type: ${file.mimetype}`, { mimeType: file.mimetype }));
    }
  
    cb(null, true);
};

export function UploadexInterceptor(field: string, isMultiple = false, maxCount = 10): NestInterceptor {
    @Injectable()
    class DynamicUploadInterceptor implements NestInterceptor {
        async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
            const req = context.switchToHttp().getRequest();
            const res = context.switchToHttp().getResponse();
            const config = UploadConfigStorage.get();

            const limits = {
                fileSize: config.maxFileSize ?? 5 * 1024 * 1024,
                files: config.maxFiles ?? maxCount,
            };
            const storage = resolveMulterStorage(config);
            const upload = multer({ storage, limits, fileFilter });

            const handler = isMultiple
                ? upload.array(field, maxCount)
                : upload.single(field);

            return new Promise((resolve, reject) => {
                handler(req, res, (error: any) => {
                    if (error) {
                        return reject(UploadexNestException(transformMulterError(error)));
                    }
                    resolve(next.handle());
                });
            });
        }
    }

    return new DynamicUploadInterceptor();
}
  