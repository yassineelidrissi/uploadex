import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';

export class UploadConfigStorage {
    
    private static config: UploadModuleOptions | null = null;

    static set(config: UploadModuleOptions) {
        this.config = config;
    }

    static get(): UploadModuleOptions {
        if (!this.config) {
            console.warn('[uploadex] config not ready yet. Returning temp config.');
            return {
                provider: 'local',
                config: { uploadPath: './uploads' },
                maxFileSize: 5 * 1024 * 1024,
                maxFiles: 10,
            };
        }
        return this.config;
    }
}