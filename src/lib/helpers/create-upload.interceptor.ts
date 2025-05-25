import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadConfigStorage } from '../utils/upload-config.storage';
import { resolveMulterStorage } from '../utils/resolve-multer.storage';

export function createUploadInterceptor(
    field: string,
    isMultiple = false,
    maxCount = 10
  ) {
    const config = UploadConfigStorage.get();
  
    const options = {
        storage: resolveMulterStorage(config),
        limits: {
            fileSize: config.maxFileSize ?? 5 * 1024 * 1024,
            files: maxCount,
        },
    };
  
    return isMultiple
        ? FilesInterceptor(field, maxCount, options)
        : FileInterceptor(field, options);
}