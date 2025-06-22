import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';

export class UploadConfigStorage {
    
    private static config: UploadModuleOptions | null = null;

    static set(config: UploadModuleOptions) {
        this.config = config;
    }

    static get(): UploadModuleOptions {
        if (!this.config) {
          throw new Error('[uploadex] Config not set. Make sure UploadModule is initialized correctly.');
        }
        return this.config;
    }
}