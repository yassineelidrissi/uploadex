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

@Module({})
export class UploadsModule {
  static registerAsync<T extends UploadProviderType>(options: {
    useFactory: () => UploadModuleOptions<T> | Promise<UploadModuleOptions<T>>;
  }): DynamicModule {
        const coreModule = UploadCoreModule.registerAsync(options);    

        return {
            module: UploadsModule,
            imports: [
                ConfigModule,
                coreModule,
            ],
            providers: [
                UploadLocalProvider,
                UploadCloudinaryProvider,
                UploadS3Provider,
                UploadAzureProvider,
                {
                    provide: UploadStrategyToken,
                    useFactory: (
                    opts: UploadModuleOptions,
                    local: UploadLocalProvider,
                    cloud: UploadCloudinaryProvider,
                    s3: UploadS3Provider,
                    azure: UploadAzureProvider,
                    ) => {
                    switch (opts.provider) {
                        case 'cloudinary':
                        return cloud;
                        case 's3':
                        return s3;
                        case 'azure':
                        return azure;
                        case 'local':
                        default:
                        return local;
                    }
                    },
                    inject: [UploadOptionsToken, UploadLocalProvider, UploadCloudinaryProvider, UploadS3Provider, UploadAzureProvider],
                },
                UploadsService,
            ],
            exports: [UploadsService],
        };
    }
}