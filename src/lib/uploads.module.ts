import { DynamicModule, Module } from '@nestjs/common';
import { UploadsService } from './providers/uploads.service';
import { MulterModule } from '@nestjs/platform-express';
import { UploadLocalProvider } from './providers/upload-local.provider';
import { UploadCloudinaryProvider } from './providers/upload-cloudinary.provider';
import { UploadStrategyToken } from './strategies/upload-strategy.token';
import { multerOptionsFactory } from './providers/multer-options.factory';
import { UploadModuleOptions, UploadProviderType } from './interfaces/upload-module-options.interface';
import { UploadOptionsToken } from './strategies/upload-options.token';
import { ConfigModule } from '@nestjs/config';
import { UploadCoreModule } from './upload-core.module';

@Module({})
export class UploadsModule {
  static registerAsync<T extends UploadProviderType>(options: {
    useFactory: () => UploadModuleOptions<T> | Promise<UploadModuleOptions<T>>;
  }): DynamicModule {
        return {
            module: UploadsModule,
            imports: [
                ConfigModule,
                UploadCoreModule.registerAsync(options),
                MulterModule.registerAsync({
                    imports: [UploadCoreModule.registerAsync(options)],
                    inject: [UploadOptionsToken],
                    useFactory: async (uploadOptions: UploadModuleOptions) => {
                    if (uploadOptions.provider === 'local') {
                        return await multerOptionsFactory(uploadOptions as UploadModuleOptions<'local'>);
                    }
                    return { storage: undefined };
                    },
                }),
            ],
            providers: [
                UploadLocalProvider,
                UploadCloudinaryProvider,
                {
                    provide: UploadStrategyToken,
                    useFactory: (
                    opts: UploadModuleOptions,
                    local: UploadLocalProvider,
                    cloud: UploadCloudinaryProvider,
                    ) => {
                    switch (opts.provider) {
                        case 'cloudinary':
                        return cloud;
                        case 'local':
                        default:
                        return local;
                    }
                    },
                    inject: [UploadOptionsToken, UploadLocalProvider, UploadCloudinaryProvider],
                },
                UploadsService,
            ],
            exports: [UploadsService],
        };
    }
}