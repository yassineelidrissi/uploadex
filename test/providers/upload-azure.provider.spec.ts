import { Test } from '@nestjs/testing';
import { UploadAzureProvider } from '../../lib/providers/upload-azure.provider';
import { UploadOptionsToken } from '../../lib/strategies/upload-options.token';
import { UploadModuleOptions } from '../../lib/interfaces/upload-module-options.interface';
import { UploadexError } from '../../lib/errors/uploadex-error';
import { UploadedFileMeta } from '../../lib/interfaces/uploaded-file-meta.interface';

jest.mock('@azure/storage-blob', () => {
    const mockUploadData = jest.fn().mockResolvedValue(undefined);
    const mockUploadStream = jest.fn().mockResolvedValue(undefined);

    const mockGetBlockBlobClient = jest.fn(() => ({
        uploadData: mockUploadData,
        uploadStream: mockUploadStream,
    }));

    const mockExists = jest.fn().mockResolvedValue(true);
    const mockCreate = jest.fn().mockResolvedValue(undefined);

    const mockGetContainerClient = jest.fn(() => ({
        exists: mockExists,
        create: mockCreate,
        getBlockBlobClient: mockGetBlockBlobClient,
    }));

    return {
        BlobServiceClient: jest.fn(() => ({
            getContainerClient: mockGetContainerClient,
        })),
        StorageSharedKeyCredential: jest.fn(),
        BlobSASPermissions: { parse: jest.fn(() => ({ permissions: 'r' })) },
        SASProtocol: { HttpsAndHttp: 'HttpsAndHttp' },
        generateBlobSASQueryParameters: jest.fn(() => ({
            toString: () => 'signed-token',
        })),
    };
});

describe('UploadAzureProvider', () => {
    let provider: UploadAzureProvider;

    const validOptions: UploadModuleOptions<'azure'> = {
        provider: 'azure',
        config: {
            accountName: 'testaccount',
            accountKey: 'testkey',
            containerName: 'testcontainer',
        },
        maxSafeMemorySize: 10 * 1024 * 1024,
        maxFileSize: 5 * 1024 * 1024,
        allowedExtensions: ['.jpg'],
        allowedMimeTypes: ['image/jpeg'],
        uploadTimeoutMs: 10000,
        uploadRetries: 1,
    };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                UploadAzureProvider,
                { provide: UploadOptionsToken, useValue: validOptions },
            ],
        }).compile();

        provider = moduleRef.get(UploadAzureProvider);
    });

    it('should upload a file using buffer', async () => {
        const file = {
            originalname: 'test.jpg',
            mimetype: 'image/jpeg',
            size: 1024,
            buffer: Buffer.from('image'),
        } as Express.Multer.File;

        const result: UploadedFileMeta = await provider.handleSingleFileUpload(file);
        expect(result.fileName).toBe('test.jpg');
        expect(result.mimeType).toBe('image/jpeg');
        expect(result.filePath).toContain('signed-token');
    });

    it('should throw UploadexError when file is missing', async () => {
        await expect(provider.handleSingleFileUpload(null as any)).rejects.toThrow(UploadexError);
    });

    it('should upload multiple files successfully', async () => {
        const files = [{
                originalname: 'one.jpg',
                mimetype: 'image/jpeg',
                size: 1024,
                buffer: Buffer.from('a'),
            }, {
                originalname: 'two.jpg',
                mimetype: 'image/jpeg',
                size: 2048,
                buffer: Buffer.from('b'),
            },
        ] as Express.Multer.File[];

        const result = await provider.handleMultipleFileUpload(files);
        expect(result).toHaveLength(2);
        expect(result[0].storedName).toMatch(/azure/);
    });

    it('should throw if no files provided in multiple upload', async () => {
        await expect(provider.handleMultipleFileUpload([])).rejects.toThrow(UploadexError);
    });
});
