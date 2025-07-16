import { Test } from '@nestjs/testing';
import { UploadAzureProvider } from '../../lib/providers/upload-azure.provider';
import { UploadOptionsToken } from '../../lib/strategies/upload-options.token';
import { UploadModuleOptions } from '../../lib/interfaces/upload-module-options.interface';
import { UploadexError } from '../../lib/errors/uploadex-error';
import * as fs from 'fs/promises';
import { Readable } from 'stream';

jest.mock('fs', () => {
    const original = jest.requireActual('fs');
    return {
        ...original,
        createReadStream: jest.fn(() => {
            const stream = new Readable();
            stream._read = () => {
                stream.push('fake stream content');
                stream.push(null);
            };
            return stream;
        }),
    };
});

jest.mock('@azure/storage-blob', () => {
    const uploadData = jest.fn().mockResolvedValue(undefined);
    const uploadStream = jest.fn().mockResolvedValue(undefined);

    const getBlockBlobClient = jest.fn(() => ({
        uploadData,
        uploadStream,
    }));

    const exists = jest.fn().mockResolvedValue(true);
    const create = jest.fn().mockResolvedValue(undefined);

    const getContainerClient = jest.fn(() => ({
        exists,
        create,
        getBlockBlobClient,
    }));

    return {
        BlobServiceClient: jest.fn(() => ({
            getContainerClient,
        })),
        StorageSharedKeyCredential: jest.fn(),
        BlobSASPermissions: { parse: jest.fn(() => ({ permissions: 'r' })) },
        SASProtocol: { HttpsAndHttp: 'HttpsAndHttp' },
        generateBlobSASQueryParameters: jest.fn(() => ({
            toString: () => 'signed-url-token',
        })),
    };
});

jest.mock('../../lib/helpers/upload-validation.helper', () => ({
    ...jest.requireActual('../../lib/helpers/upload-validation.helper'),
    cleanupFile: jest.fn().mockResolvedValue(undefined),
}));

describe('UploadAzureProvider', () => {
    let provider: UploadAzureProvider;

    const baseOptions: UploadModuleOptions<'azure'> = {
        provider: 'azure',
        config: {
            accountName: 'demo',
            accountKey: 'key',
            containerName: 'container',
        },
        maxSafeMemorySize: 1024 * 1024,
        maxFileSize: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg'],
        allowedExtensions: ['.jpg'],
        maxFiles: 5,
        uploadTimeoutMs: 5000,
        uploadRetries: 1,
    };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                UploadAzureProvider,
                { provide: UploadOptionsToken, useValue: baseOptions },
            ],
        }).compile();

        provider = moduleRef.get(UploadAzureProvider);
    });

    it('should upload single file using buffer', async () => {
        const file = {
            originalname: 'dog.jpg',
            mimetype: 'image/jpeg',
            size: 500,
            buffer: Buffer.from('fake-image'),
        } as Express.Multer.File;

        const result = await provider.handleSingleFileUpload(file);

        expect(result.fileName).toBe('dog.jpg');
        expect(result.mimeType).toBe('image/jpeg');
        expect(result.filePath).toContain('signed-url-token');
    });

    it('should upload single file using stream', async () => {
        const file = {
            originalname: 'stream.jpg',
            mimetype: 'image/jpeg',
            size: 5 * 1024 * 1024,
            path: '/fake/path/stream.jpg',
        } as unknown as Express.Multer.File;

        jest.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('skip buffer'));

        const result = await provider.handleSingleFileUpload(file);
        expect(result.filePath).toContain('signed-url-token');
    });

    it('should throw error if file missing', async () => {
        await expect(provider.handleSingleFileUpload(null as any)).rejects.toThrow(UploadexError);
    });

    it('should upload multiple files using buffer and stream', async () => {
        const files: Express.Multer.File[] = [
            {
                fieldname: 'file',
                originalname: 'buffer.jpg',
                encoding: '7bit',
                mimetype: 'image/jpeg',
                size: 500,
                buffer: Buffer.from('buffered'),
                destination: '',
                filename: 'buffer.jpg',
                path: '',
                stream: new Readable(),
            },
            {
                fieldname: 'file',
                originalname: 'stream2.jpg',
                encoding: '7bit',
                mimetype: 'image/jpeg',
                size: 5 * 1024 * 1024,
                path: '/fake/path/stream2.jpg',
                destination: '',
                filename: 'stream2.jpg',
                stream: new Readable(),
                buffer: undefined as any,
            },
        ];

        jest.spyOn(fs, 'readFile').mockImplementation((p) => {
            if (p.toString().includes('stream2.jpg')) throw new Error('simulate stream');
            return Promise.resolve(Buffer.from('skip'));
        });

        const result = await provider.handleMultipleFileUpload(files);

        expect(result).toHaveLength(2);
        expect(result[0].fileName).toBe('buffer.jpg');
        expect(result[1].fileName).toBe('stream2.jpg');
    });

    it('should throw error when multiple file array is empty', async () => {
        await expect(provider.handleMultipleFileUpload([])).rejects.toThrow(UploadexError);
    });
});
