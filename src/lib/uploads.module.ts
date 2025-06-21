import { DynamicModule, Module } from '@nestjs/common';
import { UploadsService } from './providers/uploads.service';
import { UploadLocalProvider } from './providers/upload-local.provider';
import { UploadCloudinaryProvider } from './providers/upload-cloudinary.provider';
import { UploadStrategyToken } from './strategies/upload-strategy.token';
import { UploadModuleOptions, UploadProviderType } from './interfaces/upload-module-options.interface';
import { UploadOptionsToken } from './strategies/upload-options.token';
import { ConfigModule } from '@nestjs/config';
import { UploadCoreModule } from './upload-core.module';
import { UploadS3Provider } from './providers/upload-s3.provider';
import { UploadAzureProvider } from './providers/upload-azure.provider';
import { UploadGCSProvider } from './providers/upload-gcs.provider';
import { validateUploadConfig } from './helpers/validate-config.helper';
import { UploadConfigStorage } from './utils/upload-config.storage';

@Module({})
export class UploadsModule {
  static registerAsync<T extends UploadProviderType>(options: {
    useFactory: (...args: any[]) => UploadModuleOptions<T> | Promise<UploadModuleOptions<T>>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
        const factory = async (...args: any[]) => {
            const resolved = await options.useFactory(...args);
            validateUploadConfig(resolved);
            UploadConfigStorage.set(resolved);
            return resolved;
        };
         
        const coreModule = UploadCoreModule.registerAsync({ useFactory: factory, inject: options.inject ?? [], imports: options.imports ?? [] });

        return {
            module: UploadsModule,
            imports: [
                ConfigModule,
                coreModule,
                ...(options.imports ?? [])
            ],
            providers: [
                UploadLocalProvider,
                UploadCloudinaryProvider,
                UploadS3Provider,
                UploadAzureProvider,
                UploadGCSProvider,
                {
                    provide: UploadStrategyToken,
                    useFactory: (
                    opts: UploadModuleOptions,
                    local: UploadLocalProvider,
                    cloud: UploadCloudinaryProvider,
                    s3: UploadS3Provider,
                    azure: UploadAzureProvider,
                    gcs: UploadGCSProvider
                    ) => {
                    switch (opts.provider) {
                        case 'cloudinary':
                        return cloud;
                        case 's3':
                        return s3;
                        case 'azure':
                        return azure;
                        case 'gcs':
                        return gcs;
                        case 'local':
                        default:
                        return local;
                    }
                    },
                    inject: [UploadOptionsToken, UploadLocalProvider, UploadCloudinaryProvider, UploadS3Provider, UploadAzureProvider, UploadGCSProvider],
                },
                UploadsService,
            ],
            exports: [UploadsService],
        };
    }
}