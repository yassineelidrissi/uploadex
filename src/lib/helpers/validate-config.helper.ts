import { UploadModuleOptions, UploadProviderConfig, UploadProviderType } from '../interfaces/upload-module-options.interface';
import { UploadexError, UploadexErrorCode } from '../errors/uploadex-error';

export function validateUploadConfig<T extends UploadProviderType>(
    options: UploadModuleOptions<T>
): void {
    if (!options || typeof options !== 'object') {
        throw new UploadexError('CONFIGURATION_ERROR', 'Upload options must be a valid object.');
    }

    if (!options.provider) {
        throw new UploadexError('CONFIGURATION_ERROR', 'Missing required provider in upload config.');
    }

    if (!options.config || typeof options.config !== 'object') {
        throw new UploadexError('CONFIGURATION_ERROR', 'Missing provider configuration.');
    }

    switch (options.provider) {
        case 'local': {
            const config = options.config as UploadProviderConfig<'local'>;
            if (!config.uploadPath) {
                throw new UploadexError('CONFIGURATION_ERROR', 'Missing "uploadPath" for local provider.');
            }
            break;
        }

        case 'cloudinary': {
            const config = options.config as UploadProviderConfig<'cloudinary'>;
            if (!config.cloudName || !config.apiKey || !config.apiSecret) {
                throw new UploadexError('CONFIGURATION_ERROR', 'Missing Cloudinary credentials.');
            }
            break;
        }

        case 's3': {
            const config = options.config as UploadProviderConfig<'s3'>;
            if (!config.bucket || !config.accessKeyId || !config.secretAccessKey || !config.region) {
                throw new UploadexError('CONFIGURATION_ERROR', 'Missing AWS S3 credentials.');
            }
            break;
        }

        case 'azure': {
            const config = options.config as UploadProviderConfig<'azure'>;
            if (!config.accountName || !config.accountKey || !config.containerName) {
                throw new UploadexError('CONFIGURATION_ERROR', 'Missing Azure Blob Storage credentials.');
            }
            break;
        }

        case 'gcs': {
            const config = options.config as UploadProviderConfig<'gcs'>;
            
            if (!config.bucket) {
                throw new UploadexError(
                    'CONFIGURATION_ERROR',
                    'Missing GCS bucket name.'
                );
            }
            
            const isEmulator = !!config.endpoint;
            
            if (!isEmulator && !config.keyFilename) {
                throw new UploadexError(
                    'CONFIGURATION_ERROR',
                    'Missing GCS credentials: provide either keyFilename or use emulator with endpoint.'
                );
            }
            
            if (isEmulator && config.keyFilename) {
                console.warn('[Uploadex] Warning: GCS is running in emulator mode. keyFilename will be ignored.');
            }
            
            break;
        }

        default:
            throw new UploadexError('PROVIDER_NOT_IMPLEMENTED', `Unknown provider: ${options.provider}`);
    }
}
