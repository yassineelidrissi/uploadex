import { validateFile, validateFiles, cleanupFile, transformMulterError } from '../../lib/helpers/upload-validation.helper';
import { UploadexError } from '../../lib/errors/uploadex-error';
import { promises as fs } from 'fs';
import { MulterError } from 'multer';
import { UploadConfigStorage } from '../../lib/utils/upload-config.storage';

jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn(),
  },
}));

describe('upload-validation.helper', () => {
    const mockFile = (overrides = {}): Express.Multer.File => ({
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 500 * 1024,
        path: '/tmp/test.jpg',
        ...overrides,
    } as Express.Multer.File);

    describe('validateFile', () => {
        it('should pass for valid file', async () => {
            await expect(validateFile(mockFile(), {})).resolves.not.toThrow();
        });

        it('should throw for file too large', async () => {
            const file = mockFile({ size: 10 * 1024 * 1024 }); // 10MB
            await expect(validateFile(file, { maxSize: 1 * 1024 * 1024 })).rejects.toThrowError(/Max file size/);
        });

        it('should throw for invalid extension', async () => {
            const file = mockFile({ originalname: 'malware.exe' });
            await expect(validateFile(file, {})).rejects.toThrowError(/Invalid file extension/);
        });

        it('should throw for invalid MIME type', async () => {
            const file = mockFile({ mimetype: 'application/x-msdownload' });
            await expect(validateFile(file, {})).rejects.toThrowError(/Invalid MIME type/);
        });
    });

    describe('validateFiles', () => {
        it('should pass for multiple valid files', async () => {
            const files = [mockFile(), mockFile()];
            await expect(validateFiles(files, { maxFiles: 3 })).resolves.not.toThrow();
        });

        it('should throw if too many files uploaded', async () => {
            const files = [mockFile(), mockFile(), mockFile()];
            await expect(validateFiles(files, { maxFiles: 2 })).rejects.toThrowError(/maximum of 2 files/);
        });

        it('should throw if files array is empty or missing', async () => {
            await expect(validateFiles([], {})).rejects.toThrowError(/No files uploaded/);
            await expect(validateFiles(undefined as any, {})).rejects.toThrowError(/No files uploaded/);
        });
    });

    describe('cleanupFile', () => {
        it('should call fs.unlink for file path', async () => {
            const mockUnlink = fs.unlink as jest.Mock;
            mockUnlink.mockResolvedValue(undefined);

            await cleanupFile('/tmp/test.jpg');
            expect(mockUnlink).toHaveBeenCalledWith('/tmp/test.jpg');
        });

        it('should warn if unlink fails but not throw', async () => {
            const mockUnlink = fs.unlink as jest.Mock;
            mockUnlink.mockRejectedValueOnce(new Error('fail'));

            await expect(cleanupFile('/tmp/fail.jpg')).resolves.not.toThrow();
        });
    });

    describe('transformMulterError', () => {
        beforeEach(() => 
            UploadConfigStorage.set({ 
                provider: 'local',
                config: { uploadPath: '/tmp' },
                maxFiles: 5,
                maxFileSize: 2 * 1024 * 1024,
                debug: false,
        }));

        it('should convert LIMIT_FILE_SIZE to UploadexError', () => {
            const err = new MulterError('LIMIT_FILE_SIZE');
            const result = transformMulterError(err) as UploadexError;
            expect(result).toBeInstanceOf(UploadexError);
            expect(result.code).toBe('FILE_TOO_LARGE');
        });

        it('should convert LIMIT_FILE_COUNT to UploadexError', () => {
            const err = new MulterError('LIMIT_FILE_COUNT');
            const result = transformMulterError(err) as UploadexError;
            expect(result).toBeInstanceOf(UploadexError);
            expect(result.code).toBe('MAX_FILES_EXCEEDED');
        });

        it('should convert LIMIT_UNEXPECTED_FILE to UploadexError', () => {
            const err = new MulterError('LIMIT_UNEXPECTED_FILE');
            const result = transformMulterError(err) as UploadexError;
            expect(result).toBeInstanceOf(UploadexError);
            expect(result.code).toBe('INVALID_EXTENSION');
        });

        it('should pass through unknown error', () => {
            const rawErr = new Error('unknown');
            const result = transformMulterError(rawErr);
            expect(result).toBe(rawErr);
        });
    });
});
