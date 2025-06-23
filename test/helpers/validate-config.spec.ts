import { validateUploadConfig } from '../../lib/helpers/validate-config.helper';
import { UploadexError } from '../../lib/errors/uploadex-error';
import { UploadModuleOptions } from '../../lib/interfaces/upload-module-options.interface';

describe('validateUploadConfig', () => {
    it('should throw if options is null', () => {
        expect(() => validateUploadConfig(null as any)).toThrow(UploadexError);
    });

    it('should throw if provider is missing', () => {
        const config = {} as UploadModuleOptions;
        expect(() => validateUploadConfig(config)).toThrow(/provider/);
    });

    it('should throw if config object is missing', () => {
        const config = { provider: 'local' } as UploadModuleOptions;
        expect(() => validateUploadConfig(config)).toThrow(/configuration/);
    });

    it('should validate local config', () => {
        const config: UploadModuleOptions<'local'> = {
            provider: 'local',
            config: { uploadPath: './uploads' },
        };
        expect(() => validateUploadConfig(config)).not.toThrow();
    });

    it('should throw on invalid local config', () => {
        const config = {
            provider: 'local',
            config: {},
        } as UploadModuleOptions<'local'>;
        expect(() => validateUploadConfig(config)).toThrow(/uploadPath/);
    });

    it('should validate cloudinary config', () => {
        const config: UploadModuleOptions<'cloudinary'> = {
                provider: 'cloudinary',
                config: {
                cloudName: 'demo',
                apiKey: 'key',
                apiSecret: 'secret',
            },
        };
        expect(() => validateUploadConfig(config)).not.toThrow();
    });

    it('should throw on invalid cloudinary config', () => {
        const config = {
            provider: 'cloudinary',
            config: { cloudName: 'demo' },
        } as UploadModuleOptions<'cloudinary'>;
        expect(() => validateUploadConfig(config)).toThrow(/credentials/);
    });

    it('should validate s3 config', () => {
        const config: UploadModuleOptions<'s3'> = {
                provider: 's3',
                config: {
                bucket: 'my-bucket',
                accessKeyId: 'key',
                secretAccessKey: 'secret',
                region: 'us-east-1',
            },
        };
        expect(() => validateUploadConfig(config)).not.toThrow();
    });

    it('should throw on invalid s3 config', () => {
        const config = {
            provider: 's3',
            config: { bucket: 'bucket' },
        } as UploadModuleOptions<'s3'>;
        expect(() => validateUploadConfig(config)).toThrow(/credentials/);
    });

    it('should validate azure config', () => {
        const config: UploadModuleOptions<'azure'> = {
                provider: 'azure',
                config: {
                accountName: 'acc',
                accountKey: 'key',
                containerName: 'container',
            },
        };
        expect(() => validateUploadConfig(config)).not.toThrow();
    });

    it('should throw on invalid azure config', () => {
        const config = {
            provider: 'azure',
            config: {},
        } as UploadModuleOptions<'azure'>;
        expect(() => validateUploadConfig(config)).toThrow(/credentials/);
    });

    it('should validate GCS config in emulator mode (endpoint only)', () => {
        const config: UploadModuleOptions<'gcs'> = {
                provider: 'gcs',
                config: {
                bucket: 'my-bucket',
                endpoint: 'http://fake-gcs:4443',
            },
        };
        expect(() => validateUploadConfig(config)).not.toThrow();
    });

    it('should validate GCS config in real mode (keyFilename)', () => {
        const config: UploadModuleOptions<'gcs'> = {
                provider: 'gcs',
                config: {
                bucket: 'my-bucket',
                keyFilename: '/fake/path/to/key.json',
            },
        };
        expect(() => validateUploadConfig(config)).not.toThrow();
    });

    it('should warn if both keyFilename and endpoint are provided (emulator)', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const config: UploadModuleOptions<'gcs'> = {
                provider: 'gcs',
                config: {
                bucket: 'my-bucket',
                keyFilename: 'key.json',
                endpoint: 'http://localhost:4443',
            },
        };
        validateUploadConfig(config);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('GCS is running in emulator mode')
        );
        warnSpy.mockRestore();
    });

    it('should throw if GCS keyFilename is missing and not using emulator', () => {
        const config = {
                provider: 'gcs',
                config: {
                bucket: 'bucket',
            },
        } as UploadModuleOptions<'gcs'>;
        expect(() => validateUploadConfig(config)).toThrow(/credentials/);
    });

    it('should throw for unknown provider', () => {
        const config = {
            provider: 'invalid-provider',
            config: {},
        } as unknown as UploadModuleOptions<any>;
        expect(() => validateUploadConfig(config)).toThrow(/Unknown provider/);
    });
});
