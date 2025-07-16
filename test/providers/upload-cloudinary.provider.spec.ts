import { Test } from '@nestjs/testing';
import { UploadCloudinaryProvider } from '../../lib/providers/upload-cloudinary.provider';
import { UploadOptionsToken } from '../../lib/strategies/upload-options.token';
import { UploadModuleOptions } from '../../lib/interfaces/upload-module-options.interface';
import { UploadexError } from '../../lib/errors/uploadex-error';
import { UploadedFileMeta } from '../../lib/interfaces/uploaded-file-meta.interface';
import { Readable } from 'stream';

jest.mock('cloudinary', () => {
    const { Writable } = require('stream');
    return {
        v2: {
            uploader: {
                upload_stream: (_opts: any, callback: Function) => {
                    const writable = new Writable({
                        write(_chunk, _encoding, done) {
                            done();
                        },
                        final(done) {
                            callback(null, {
                                secure_url: 'https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg',
                            });
                            done();
                        },
                    });
                    return writable;
                },
            },
            config: jest.fn(),
        },
    };
});

jest.mock('fs', () => {
    const original = jest.requireActual('fs');
    const { Readable } = require('stream');
    return {
        ...original,
        createReadStream: jest.fn(() => {
            const readable = new Readable();
            readable._read = () => {
                readable.push('stream content');
                readable.push(null);
            };
            return readable;
        }),
        unlink: jest.fn().mockResolvedValue(undefined),
    };
});

describe('UploadCloudinaryProvider', () => {
    let provider: UploadCloudinaryProvider;

    const options: UploadModuleOptions<'cloudinary'> = {
        provider: 'cloudinary',
        config: {
            cloudName: 'demo',
            apiKey: 'fakekey',
            apiSecret: 'fakesecret',
        },
        maxSafeMemorySize: 100,
        maxFileSize: 5 * 1024 * 1024,
        allowedExtensions: ['.jpg'],
        allowedMimeTypes: ['image/jpeg'],
        uploadTimeoutMs: 10000,
        uploadRetries: 1,
    };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                UploadCloudinaryProvider,
                { provide: UploadOptionsToken, useValue: options },
            ],
        }).compile();

        provider = moduleRef.get(UploadCloudinaryProvider);
    });

    it('should upload single file using buffer', async () => {
        const file = {
            originalname: 'photo.jpg',
            mimetype: 'image/jpeg',
            size: 50,
            buffer: Buffer.from('fake-image'),
        } as Express.Multer.File;

        const result: UploadedFileMeta = await provider.handleSingleFileUpload(file);

        expect(result.fileName).toBe('photo.jpg');
        expect(result.mimeType).toBe('image/jpeg');
        expect(result.filePath).toContain('cloudinary.com');
    });

    it('should upload single file using stream when buffer is skipped', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const file = {
            originalname: 'photo.jpg',
            mimetype: 'image/jpeg',
            size: 1024 * 1024 * 2,
            path: '/fake/path/photo.jpg',
        } as Express.Multer.File;

        const result: UploadedFileMeta = await provider.handleSingleFileUpload(file);

        expect(result.fileName).toBe('photo.jpg');
        expect(result.filePath).toContain('cloudinary.com');
        warnSpy.mockRestore();
    });

    it('should upload multiple files using buffers', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const files = [
            {
                originalname: 'file1.jpg',
                mimetype: 'image/jpeg',
                size: 50,
                buffer: Buffer.from('buffer1'),
            },
            {
                originalname: 'file2.jpg',
                mimetype: 'image/jpeg',
                size: 75,
                buffer: Buffer.from('buffer2'),
            },
        ] as Express.Multer.File[];

        const result = await provider.handleMultipleFileUpload(files);

        expect(result).toHaveLength(2);
        expect(result[0].filePath).toContain('cloudinary.com');
        warnSpy.mockRestore();
    });

    it('should upload multiple files using stream', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const files = [
            {
                originalname: 'stream1.jpg',
                mimetype: 'image/jpeg',
                size: 1024 * 1024,
                path: '/fake/path/stream1.jpg',
            },
            {
                originalname: 'stream2.jpg',
                mimetype: 'image/jpeg',
                size: 1024 * 1024,
                path: '/fake/path/stream2.jpg',
            },
        ] as Express.Multer.File[];

        const result = await provider.handleMultipleFileUpload(files);

        expect(result).toHaveLength(2);
        expect(result[1].fileName).toBe('stream2.jpg');
        warnSpy.mockRestore();
    });

    it('should throw UploadexError if file is missing', async () => {
        await expect(provider.handleSingleFileUpload(null as any)).rejects.toThrow(UploadexError);
    });

    it('should throw UploadexError if multiple upload input is empty', async () => {
        await expect(provider.handleMultipleFileUpload([])).rejects.toThrow(UploadexError);
    });
});
