import { promises as fs } from 'fs';
import { UploadexError } from '../errors/uploadex-error';

export async function shouldUseBuffer(file: Express.Multer.File, maxSafeMemorySize: number): Promise<boolean> {
    if (!file || typeof file.size !== 'number') return false;

    if (file.size > maxSafeMemorySize) return false;

    if (file.buffer) return true;

    if (file.path) {
        try {
            file.buffer = await fs.readFile(file.path);
            return true;
        } catch (err) {
            throw new UploadexError('UNKNOWN', 'Failed to hydrate buffer from disk', { cause: err });
        }
    }

    return false;
}