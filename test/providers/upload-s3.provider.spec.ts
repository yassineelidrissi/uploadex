import { Test } from '@nestjs/testing';
import { UploadS3Provider } from '../../lib/providers/upload-s3.provider';
import { UploadOptionsToken } from '../../lib/strategies/upload-options.token';
import { UploadModuleOptions } from '../../lib/interfaces/upload-module-options.interface';
import { UploadedFileMeta } from '../../lib/interfaces/uploaded-file-meta.interface';
import { UploadexError } from '../../lib/errors/uploadex-error';
import * as fs from 'fs';

jest.mock('fs', () => ({
    createReadStream: jest.fn(() => 'MOCK_STREAM'),
    promises: {
        unlink: jest.fn(),
    },
}));

jest.mock('@aws-sdk/client-s3', () => {
    return {
        S3Client: jest.fn().mockImplementation(() => ({
            send: jest.fn().mockImplementation((command: any) => {
                const name = command?.constructor?.name;
                if (name === 'PutObjectCommand') return Promise.resolve({});
                if (name === 'HeadBucketCommand') return Promise.resolve({});
                if (name === 'CreateBucketCommand') return Promise.resolve({});
                throw new Error(`Unknown command: ${name}`);
            }),
        })),
        PutObjectCommand: jest.fn().mockImplementation(function (params) {
            this.constructor = { name: 'PutObjectCommand' };
            Object.assign(this, params);
        }),
        HeadBucketCommand: jest.fn().mockImplementation(function (params) {
            this.constructor = { name: 'HeadBucketCommand' };
            Object.assign(this, params);
        }),
        CreateBucketCommand: jest.fn().mockImplementation(function (params) {
            this.constructor = { name: 'CreateBucketCommand' };
            Object.assign(this, params);
        }),
    };
});
  

describe('UploadS3Provider', () => {
    let provider: UploadS3Provider;

    const options: UploadModuleOptions<'s3'> = {
        provider: 's3',
        config: {
            bucket: 'my-bucket',
            region: 'us-east-1',
            accessKeyId: 'key',
            secretAccessKey: 'secret',
            endpoint: 'http://localhost:4566',
            checkBucket: true,
        },
        maxSafeMemorySize: 1,
        maxFileSize: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg'],
        allowedExtensions: ['.jpg'],
        uploadRetries: 1,
        uploadTimeoutMs: 10000,
        debug: false,
    };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                UploadS3Provider,
                { provide: UploadOptionsToken, useValue: options },
            ],
        }).compile();

        provider = moduleRef.get(UploadS3Provider);
    });

    it('should upload single file using stream', async () => {
        const file = {
            originalname: 'dog.jpg',
            mimetype: 'image/jpeg',
            size: 3000,
            path: '/fake/path/dog.jpg',
        } as Express.Multer.File;

        const result: UploadedFileMeta = await provider.handleSingleFileUpload(file);

        expect(result.fileName).toBe('dog.jpg');
        expect(result.filePath).toContain('localhost');
        expect(result.mimeType).toBe('image/jpeg');
    });

    it('should upload multiple files using stream', async () => {
        const files = [{
                originalname: '1.jpg',
                mimetype: 'image/jpeg',
                size: 1234,
                path: '/fake/path/1.jpg',
            }, {
                originalname: '2.jpg',
                mimetype: 'image/jpeg',
                size: 2345,
                path: '/fake/path/2.jpg',
            },
        ] as Express.Multer.File[];

        const result = await provider.handleMultipleFileUpload(files);

        expect(result).toHaveLength(2);
        expect(result[0].filePath).toContain('localhost');
        expect(result[1].filePath).toContain('localhost');
    });

    it('should upload single file using buffer', async () => {
        const file = {
            originalname: 'cat.jpg',
            mimetype: 'image/jpeg',
            size: 500,
            buffer: Buffer.from('cat-image'),
        } as Express.Multer.File;

        (provider as any).maxSafeMemorySize = 10 * 1024 * 1024;

        const result = await provider.handleSingleFileUpload(file);

        expect(result.fileName).toBe('cat.jpg');
        expect(result.filePath).toContain('localhost');
        expect(result.mimeType).toBe('image/jpeg');
    });

    it('should upload multiple files using buffer', async () => {
        const files = [{
                originalname: 'a.jpg',
                mimetype: 'image/jpeg',
                size: 999,
                buffer: Buffer.from('a'),
            }, {
                originalname: 'b.jpg',
                mimetype: 'image/jpeg',
                size: 1999,
                buffer: Buffer.from('b'),
            },
        ] as Express.Multer.File[];

        (provider as any).maxSafeMemorySize = 10 * 1024 * 1024;

        const result = await provider.handleMultipleFileUpload(files);

        expect(result).toHaveLength(2);
        expect(result[0].filePath).toContain('localhost');
    });

    it('should throw UploadexError if single file is missing', async () => {
        await expect(provider.handleSingleFileUpload(null as any)).rejects.toThrow(UploadexError);
    });

    it('should throw UploadexError if multiple files are empty', async () => {
        await expect(provider.handleMultipleFileUpload([])).rejects.toThrow(UploadexError);
    });
});
