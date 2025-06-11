export type UploadProviderType = 'local' | 'cloudinary' | 's3' | 'azure';

export type UploadProviderConfig<T extends UploadProviderType> =
    T extends 'local'
    ? { uploadPath: string }
    : T extends 'cloudinary'
    ? { cloudName: string; apiKey: string; apiSecret: string }
    : T extends 's3'
    ? { bucket: string; accessKeyId: string; secretAccessKey: string, region: string, endpoint?: string }
    : T extends 'azure'
    ? { accountName: string; accountKey: string; containerName: string }
    : never;

export interface UploadModuleOptions<T extends UploadProviderType = UploadProviderType> {
    provider: T;
    config: UploadProviderConfig<T>;
    maxFileSize?: number;
    maxFiles?: number;
    allowedMimeTypes?: string[];
    allowedExtensions?: string[];
    maxSafeMemorySize?: number;
    debug?: boolean;
}