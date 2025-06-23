import { safeUpload } from '../../lib/helpers/safe-upload.helper';
import { UploadexError } from '../../lib/errors/uploadex-error';

describe('safeUpload', () => {
    it('should resolve successfully on first attempt without timeout', async () => {
        const task = jest.fn().mockResolvedValue('ok');

        const result = await safeUpload(task);
        expect(result).toBe('ok');
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('should retry failed task and succeed on second attempt', async () => {
        const task = jest.fn()
            .mockRejectedValueOnce(new Error('fail once'))
            .mockResolvedValueOnce('success');

        const result = await safeUpload(task, { retries: 1 });
        expect(result).toBe('success');
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('should throw UploadexError after exhausting retries', async () => {
        const task = jest.fn().mockRejectedValue(new Error('always fails'));

        await expect(safeUpload(task, { retries: 2 }))
            .rejects.toThrow(UploadexError);

        expect(task).toHaveBeenCalledTimes(3);
    });


    it('should trigger onCleanup after each failure', async () => {
    const cleanup = jest.fn().mockResolvedValue(undefined);

        const task = jest.fn()
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValueOnce('done');

        const result = await safeUpload(task, { retries: 1, onCleanup: cleanup });

        expect(result).toBe('done');
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('should timeout if task takes too long', async () => {
        const longTask = () =>
            new Promise((resolve) => setTimeout(() => resolve('too late'), 200));

        await expect(safeUpload(longTask, { timeoutMs: 100 }))
            .rejects.toThrow(UploadexError);

        await expect(safeUpload(longTask, { timeoutMs: 100 }))
            .rejects.toThrow(/timed out/);
    });
});
