import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadConfigStorage } from '../utils/upload-config.storage';
import { resolveMulterStorage } from '../utils/resolve-multer.storage';
  
export function CreateUploadInterceptor(field: string, isMultiple = false, maxCount = 10): NestInterceptor {
    @Injectable()
    class DynamicUploadInterceptor implements NestInterceptor {
        async intercept(context: ExecutionContext, next: CallHandler) {
            const config = UploadConfigStorage.get();

            const options = {
                storage: resolveMulterStorage(config),
                limits: {
                    fileSize: config.maxFileSize ?? 5 * 1024 * 1024,
                    files: config.maxFiles ?? maxCount,
                },
            };

            const factory = isMultiple
                ? FilesInterceptor(field, maxCount, options)
                : FileInterceptor(field, options);

            const instance = new factory();
            return instance.intercept(context, next);
        }
    }

    return new DynamicUploadInterceptor();
}
  