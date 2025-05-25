import { DynamicModule, Module } from '@nestjs/common';
import { UploadModuleOptions, UploadProviderType } from './interfaces/upload-module-options.interface';
import { UploadOptionsToken } from './strategies/upload-options.token';
import { UploadConfigStorage } from './utils/upload-config.storage';

@Module({})
export class UploadCoreModule {
    static registerAsync<T extends UploadProviderType>(options: {
        useFactory: () => UploadModuleOptions<T> | Promise<UploadModuleOptions<T>>;
    }): DynamicModule {
        return {
            module: UploadCoreModule,
            providers: [
            {
                provide: UploadOptionsToken,
                useFactory: async () => {
                    const resolved = await options.useFactory();
                    UploadConfigStorage.set(resolved);
                    return resolved;
                },
                },
            ],
            exports: [UploadOptionsToken],
        };
    }
}