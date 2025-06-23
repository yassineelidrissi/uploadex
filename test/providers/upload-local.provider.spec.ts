import { Test } from '@nestjs/testing';
import { UploadLocalProvider } from '../../lib/providers/upload-local.provider';
import { UploadOptionsToken } from '../../lib/strategies/upload-options.token';
import { UploadModuleOptions } from '../../lib/interfaces/upload-module-options.interface';
import { UploadexError } from '../../lib/errors/uploadex-error';
import * as fs from 'fs/promises';
import * as path from 'path';

jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return {
        ...actual,
        promises: {
            ...actual.promises,
            writeFile: jest.fn().mockResolvedValue(undefined),
            unlink: jest.fn().mockResolvedValue(undefined),
        },
        createWriteStream: jest.fn(() => ({
            on: jest.fn(),
            end: jest.fn(),
        })),
        createReadStream: jest.fn(() => ({
            pipe: jest.fn(),
        })),
    };
});

jest.mock('../../lib/helpers/upload-validation.helper', () => ({
    ...jest.requireActual('../../lib/helpers/upload-validation.helper'),
    cleanupFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('stream/promises', () => ({
    pipeline: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/helpers/buffer-hydration.helper', () => ({
    shouldUseBuffer: jest.fn(async (file, limit) => !!file.buffer),
}));

describe('UploadLocalProvider', () => {
    let provider: UploadLocalProvider;

    const options: UploadModuleOptions<'local'> = {
        provider: 'local',
        config: {
            uploadPath: './uploadex-dir',
        },
        maxFileSize: 5 * 1024 * 1024,
        maxFiles: 4,
        allowedMimeTypes: ['image/jpeg'],
        allowedExtensions: ['.jpg'],
        maxSafeMemorySize: 1024 * 1024,
        uploadRetries: 1,
        uploadTimeoutMs: 3000,
    };

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
            UploadLocalProvider,
            { provide: UploadOptionsToken, useValue: options },
            ],
        }).compile();

        provider = moduleRef.get(UploadLocalProvider);
    });

    it('should upload single file using buffer', async () => {
        const file = {
            originalname: 'buffer.jpg',
            mimetype: 'image/jpeg',
            size: 1024,
            buffer: Buffer.from('data'),
        } as Express.Multer.File;

        const result = await provider.handleSingleFileUpload(file);
        expect(result.fileName).toBe('buffer.jpg');
        expect(result.filePath).toMatch(/uploadex-dir/);
    });

    it('should upload single file using stream', async () => {
        const file = {
            originalname: 'stream.jpg',
            mimetype: 'image/jpeg',
            size: 2048,
            path: '/tmp/stream.jpg',
        } as Express.Multer.File;

        const shouldUseBuffer = require('../../lib/helpers/buffer-hydration.helper')
            .shouldUseBuffer;
        shouldUseBuffer.mockResolvedValueOnce(false);

        const result = await provider.handleSingleFileUpload(file);
        expect(result.fileName).toBe('stream.jpg');
        expect(result.filePath).toMatch(/uploadex-dir/);
    });

    it('should throw error if no file provided', async () => {
        await expect(provider.handleSingleFileUpload(null as any)).rejects.toThrow(
            UploadexError,
        );
    });

    it('should upload multiple files (buffer + stream)', async () => {
        const shouldUseBuffer = require('../../lib/helpers/buffer-hydration.helper')
            .shouldUseBuffer;

        shouldUseBuffer.mockImplementation(async (file) => !!file.buffer);

        const files = [{
                originalname: 'one.jpg',
                mimetype: 'image/jpeg',
                size: 500,
                buffer: Buffer.from('one'),
            }, {
                originalname: 'two.jpg',
                mimetype: 'image/jpeg',
                size: 2000,
                path: '/tmp/two.jpg',
            },
        ] as Partial<Express.Multer.File>[] as Express.Multer.File[];

        const result = await provider.handleMultipleFileUpload(files);

        expect(result).toHaveLength(2);
        expect(result[0].storedName).toMatch(/local/);
        expect(result[1].storedName).toMatch(/local/);
    });

    it('should throw if multiple file upload array is empty', async () => {
        await expect(provider.handleMultipleFileUpload([])).rejects.toThrow(UploadexError);
    });
});
