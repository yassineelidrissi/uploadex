import { ExecutionContext, CallHandler } from '@nestjs/common';
import { UploadConfigStorage } from '../../lib/utils/upload-config.storage';
import { UploadexInterceptor } from '../../lib/helpers/create-upload.interceptor';
import { firstValueFrom, of } from 'rxjs';
import * as multer from 'multer';
import { UploadexError } from '../../lib/errors/uploadex-error';
import { MulterError } from 'multer';

jest.mock('multer');

describe('UploadexInterceptor', () => {
    const next: CallHandler = {
        handle: jest.fn(() => of('handled')),
    };

    const createContext = (req: any = {}, res: any = {}) => ({
        switchToHttp: () => ({
            getRequest: () => req,
            getResponse: () => res,
        }),
    }) as unknown as ExecutionContext;

    beforeEach(() => {
        jest.clearAllMocks();
        UploadConfigStorage.set({
            provider: 'local',
            config: { uploadPath: '/tmp' },
            maxFiles: 2,
            maxFileSize: 1 * 1024 * 1024,
            allowedMimeTypes: ['image/jpeg'],
            allowedExtensions: ['.jpg'],
            debug: false,
        });
    });

    it('should call next.handle() after successful single upload', async () => {
        const mockReq = {};
        const mockRes = {};
        const multerMock = {
            single: jest.fn(() => (req: any, res: any, cb: Function) => cb(null)),
        };
        (multer as unknown as jest.Mock).mockReturnValue(multerMock);

        const interceptor = UploadexInterceptor('avatar');
        const observable = await interceptor.intercept(createContext(mockReq, mockRes), next);
        const result = await firstValueFrom(observable);

        expect(result).toBe('handled');
        expect(multerMock.single).toHaveBeenCalledWith('avatar');
    });

    it('should call next.handle() after successful multiple upload', async () => {
        const mockReq = {};
        const mockRes = {};
        const multerMock = {
            array: jest.fn(() => (req: any, res: any, cb: Function) => cb(null)),
        };
        (multer as unknown as jest.Mock).mockReturnValue(multerMock);

        const interceptor = UploadexInterceptor('photos', true, 5);
        const observable = await interceptor.intercept(createContext(mockReq, mockRes), next);
        const result = await firstValueFrom(observable);

        expect(result).toBe('handled');
        expect(multerMock.array).toHaveBeenCalledWith('photos', 5);
    });

    it('should reject with UploadexError for invalid extension', async () => {
        const mockReq = {
                file: {
                originalname: 'bad.exe',
                mimetype: 'image/jpeg',
            },
        };
        const mockRes = {};
        const multerMock = {
            single: jest.fn(() => (req: any, res: any, cb: Function) =>
                cb(new UploadexError('INVALID_EXTENSION', 'Invalid extension'))
            ),
        };
        (multer as unknown as jest.Mock).mockReturnValue(multerMock);

        const interceptor = UploadexInterceptor('file');
        await expect(
            interceptor.intercept(createContext(mockReq, mockRes), next)
        ).rejects.toThrow('Invalid extension');
    });

    it('should reject with UploadexError for invalid MIME type', async () => {
        const mockReq = {
                file: {
                originalname: 'test.jpg',
                mimetype: 'application/x-msdownload',
            },
        };
        const mockRes = {};
        const multerMock = {
            single: jest.fn(() => (req: any, res: any, cb: Function) =>
                cb(new UploadexError('INVALID_MIME_TYPE', 'Invalid MIME type'))
            ),
        };
        (multer as unknown as jest.Mock).mockReturnValue(multerMock);

        const interceptor = UploadexInterceptor('file');
        await expect(
            interceptor.intercept(createContext(mockReq, mockRes), next)
        ).rejects.toThrow('Invalid MIME type');
    });

    it('should transform and reject MulterError', async () => {
        const mockReq = {};
        const mockRes = {};

        const fakeMulterError = new Error('File too large') as any;
        fakeMulterError.code = 'LIMIT_FILE_SIZE';
        Object.setPrototypeOf(fakeMulterError, MulterError.prototype);

        const multerMock = {
            single: jest.fn(() => (req: any, res: any, cb: Function) =>
                cb(fakeMulterError)
            ),
        };
        (multer as unknown as jest.Mock).mockReturnValue(multerMock);

        const interceptor = UploadexInterceptor('file');
        await expect(
            interceptor.intercept(createContext(mockReq, mockRes), next)
        ).rejects.toThrow('File too large');
    });

    it('should reject unknown error as UploadexError', async () => {
        const mockReq = {};
        const mockRes = {};
        const multerMock = {
            single: jest.fn(() => (req: any, res: any, cb: Function) =>
                cb(new Error('Unknown failure'))
            ),
        };
        (multer as unknown as jest.Mock).mockReturnValue(multerMock);

        const interceptor = UploadexInterceptor('file');
        await expect(
            interceptor.intercept(createContext(mockReq, mockRes), next)
        ).rejects.toThrow('Unknown failure');
    });

    it('should reject on error during multiple file upload', async () => {
        const multerMock = {
            array: jest.fn(() => (req: any, res: any, cb: Function) =>
                cb(new UploadexError('UPLOAD_FAILED', 'Array upload failed'))
            ),
        };
        (multer as unknown as jest.Mock).mockReturnValue(multerMock);
      
        const interceptor = UploadexInterceptor('photos', true, 5);
      
        await expect(
            interceptor.intercept(createContext({}, {}), next)
        ).rejects.toThrow('Unexpected upload error');
    });
      
});
