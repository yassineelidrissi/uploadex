import { shouldUseBuffer } from '../../lib/helpers/buffer-hydration.helper';
import { promises as fs } from 'fs';
import { UploadexError } from '../../lib/errors/uploadex-error';

jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
    },
}));

describe('shouldUseBuffer', () => {
    const mockFs = fs as jest.Mocked<typeof fs>;

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return true if file has buffer and is under max size', async () => {
        const file = {
            size: 1024 * 100,
            buffer: Buffer.from('sample data'),
        } as Express.Multer.File;

        const result = await shouldUseBuffer(file, 1024 * 200);
        expect(result).toBe(true);
    });

    it('should return false if file size exceeds maxSafeMemorySize', async () => {
        const file = {
            size: 1024 * 500,
            buffer: Buffer.from('large data'),
        } as Express.Multer.File;

        const result = await shouldUseBuffer(file, 1024 * 100);
        expect(result).toBe(false);
    });

    it('should hydrate buffer from path if no buffer and under max size', async () => {
        const file = {
            size: 1024 * 50,
            path: '/tmp/testfile.txt',
        } as unknown as Express.Multer.File;

        const fakeBuffer = Buffer.from('file content');
        mockFs.readFile.mockResolvedValueOnce(fakeBuffer);

        const result = await shouldUseBuffer(file, 1024 * 100);
        expect(result).toBe(true);
        expect(file.buffer).toEqual(fakeBuffer);
        expect(mockFs.readFile).toHaveBeenCalledWith('/tmp/testfile.txt');
    });

    it('should throw UploadexError if fs.readFile fails', async () => {
        const file = {
            size: 1024 * 50,
            path: '/tmp/fail.txt',
        } as unknown as Express.Multer.File;

        mockFs.readFile.mockRejectedValueOnce(new Error('Disk failure'));

        await expect(shouldUseBuffer(file, 1024 * 100)).rejects.toThrow(UploadexError);
    });

    it('should return false if file is missing or invalid', async () => {
        const result1 = await shouldUseBuffer(null as any, 100000);
        const result2 = await shouldUseBuffer({} as Express.Multer.File, 100000);

        expect(result1).toBe(false);
        expect(result2).toBe(false);
    });
});
