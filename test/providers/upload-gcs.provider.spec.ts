import { Test } from '@nestjs/testing';
import { UploadGCSProvider } from '../../lib/providers/upload-gcs.provider';
import { UploadModuleOptions } from '../../lib/interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../../lib/strategies/upload-options.token';
import { UploadexError } from '../../lib/errors/uploadex-error';
import { Readable } from 'stream';
import * as fs from 'fs';

jest.mock('@google-cloud/storage', () => {
    const mockWriteStream = () => {
        const { Writable } = require('stream');
        return new Writable({
            write(_chunk, _enc, cb) {
                cb();
            },
            final(cb) {
                cb();
            },
        });
    };

    return {
        Storage: jest.fn().mockImplementation(() => ({
            bucket: jest.fn().mockImplementation(() => ({
                exists: jest.fn().mockResolvedValue([true]),
                create: jest.fn().mockResolvedValue(undefined),
                file: jest.fn().mockImplementation(() => ({
                    save: jest.fn().mockResolvedValue(undefined),
                    createWriteStream: jest.fn(() => mockWriteStream()),
                    getSignedUrl: jest.fn().mockResolvedValue(['https://signed-url.com/fakefile']),
                })),
            })),
        })),
    };
});

jest.mock('fs', () => {
    const original = jest.requireActual('fs');
    return {
        ...original,
        createReadStream: jest.fn(() => {
            const stream = new Readable();
                stream._read = () => {
                stream.push('mock file content');
                stream.push(null);
            };
            return stream;
        }),
    };
});

describe('UploadGCSProvider', () => {
    let provider: UploadGCSProvider;

    const gcsOptions: UploadModuleOptions<'gcs'> = {
        provider: 'gcs',
        config: {
            bucket: 'test-bucket',
            projectId: 'test',
        },
        maxSafeMemorySize: 10,
        maxFileSize: 1024 * 1024,
        allowedExtensions: ['.jpg'],
        allowedMimeTypes: ['image/jpeg'],
        uploadRetries: 1,
        uploadTimeoutMs: 10000,
    };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                UploadGCSProvider,
                { provide: UploadOptionsToken, useValue: gcsOptions },
            ],
        }).compile();

        provider = moduleRef.get(UploadGCSProvider);
    });

    it('should upload single file using buffer', async () => {
        const file = {
            originalname: 'cat.jpg',
            mimetype: 'image/jpeg',
            size: 5,
            buffer: Buffer.from('img'),
        } as Express.Multer.File;

        const result = await provider.handleSingleFileUpload(file);

        expect(result.fileName).toBe('cat.jpg');
        expect(result.filePath).toContain('signed-url.com');
        expect(result.mimeType).toBe('image/jpeg');
    });

    it('should upload single file using stream', async () => {
        const file = {
            originalname: 'dog.jpg',
            mimetype: 'image/jpeg',
            size: 1000,
            path: '/fake/path/dog.jpg',
        } as Express.Multer.File;

        const result = await provider.handleSingleFileUpload(file);

        expect(result.fileName).toBe('dog.jpg');
        expect(result.filePath).toContain('signed-url.com');
    });

    it('should upload multiple files (buffer + stream)', async () => {
        const files = [{
                originalname: '1.jpg',
                mimetype: 'image/jpeg',
                size: 5,
                buffer: Buffer.from('img1'),
            }, {
                originalname: '2.jpg',
                mimetype: 'image/jpeg',
                size: 3000,
                path: '/fake/path/2.jpg',
            },
        ] as Partial<Express.Multer.File>[] as Express.Multer.File[];

        const result = await provider.handleMultipleFileUpload(files);

        expect(result).toHaveLength(2);
        expect(result[0].filePath).toContain('signed-url.com');
        expect(result[1].filePath).toContain('signed-url.com');
    });

    it('should throw UploadexError if no file passed to single upload', async () => {
        await expect(provider.handleSingleFileUpload(null as any)).rejects.toThrow(UploadexError);
    });

    it('should throw UploadexError if empty array passed to multi upload', async () => {
        await expect(provider.handleMultipleFileUpload([])).rejects.toThrow(UploadexError);
    });
});
