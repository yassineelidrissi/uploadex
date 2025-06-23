import { resolveMulterStorage } from '../../lib/utils/resolve-multer.storage';
import { UploadModuleOptions } from '../../lib/interfaces/upload-module-options.interface';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('resolveMulterStorage', () => {
    const mockMkdirSync = fs.mkdirSync as jest.Mock;
    const mockExistsSync = fs.existsSync as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should create cloud temp dir if not exists', () => {
        mockExistsSync.mockReturnValue(false);
        mockMkdirSync.mockImplementation(() => {});

        const config: UploadModuleOptions = {
            provider: 's3',
            config: {
                bucket: 'bucket',
                accessKeyId: 'id',
                secretAccessKey: 'secret',
                region: 'us-west-1',
            },
        };

        resolveMulterStorage(config);
        const expected = path.resolve(process.cwd(), './uploadex-temp');

        expect(mockExistsSync).toHaveBeenCalledWith(expected);
        expect(mockMkdirSync).toHaveBeenCalledWith(expected, { recursive: true });
    });

    it('should use existing cloud path if exists', () => {
        mockExistsSync.mockReturnValue(true);

        const config: UploadModuleOptions = {
            provider: 'gcs',
            config: {
                bucket: 'bucket',
                projectId: 'id',
            },
        };

        resolveMulterStorage(config);
        const expected = path.resolve(process.cwd(), './uploadex-temp');

        expect(mockExistsSync).toHaveBeenCalledWith(expected);
    });
  

    it('should use custom uploadPath for local provider', () => {
        mockExistsSync.mockReturnValue(false);
        mockMkdirSync.mockImplementation(() => {});

        const config: UploadModuleOptions = {
            provider: 'local',
            config: {
                uploadPath: 'my-uploads',
            },
        };

        resolveMulterStorage(config);
        const expected = path.resolve(process.cwd(), 'my-uploads');

        expect(mockExistsSync).toHaveBeenCalledWith(expected);
        expect(mockMkdirSync).toHaveBeenCalledWith(expected, { recursive: true });
    });

    it('should fallback to default path for local provider if uploadPath not set', () => {
        mockExistsSync.mockReturnValue(false);
        mockMkdirSync.mockImplementation(() => {});

        const config: UploadModuleOptions = {
            provider: 'local',
            config: {} as any,
        };

        resolveMulterStorage(config);
        const expected = path.resolve(process.cwd(), './uploadex-temp');

        expect(mockExistsSync).toHaveBeenCalledWith(expected);
        expect(mockMkdirSync).toHaveBeenCalledWith(expected, { recursive: true });
    });
  
});
