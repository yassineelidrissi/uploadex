import { DynamicModule, Module } from '@nestjs/common';
import { UploadModuleOptions, UploadProviderType } from './interfaces/upload-module-options.interface';
import { UploadOptionsToken } from './strategies/upload-options.token';

@Module({})
export class UploadCoreModule {
    static registerAsync<T extends UploadProviderType>(options: {
        useFactory: (...args: any[]) => UploadModuleOptions<T> | Promise<UploadModuleOptions<T>>;
        imports?: any[];
        inject?: any[];
    }): DynamicModule {
        return {
            module: UploadCoreModule,
            imports: options.imports ?? [],
            providers: [
            {
                provide: UploadOptionsToken,
                useFactory: options.useFactory,
                inject: options.inject ?? [],
            },
            ],
            exports: [UploadOptionsToken],
        };
    }
}