import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a sanitized and unique filename using the original name and UUID.
 * Replaces spaces/special characters
 */
export function generateSafeFilename(originalName: string, prefix = 'upload'): string {
    if (!originalName || typeof originalName !== 'string') return 'file';
    const uniqueId = uuidv4();
    const name = originalName
        .replace(extname(originalName), '')
        .toLowerCase()
        .replace(/[<>:"/\\|?*{}\[\]();!@#$%^&+=]/g, '-') // Remove dangerous chars
        .replace(/[^a-z0-9]/gi, '-')  // Replace non-alphanumeric with dashes
        .replace(/-+/g, '-')           // Collapse repeated dashes
        .replace(/^-+|-+$/g, '');      // Trim dashes

    const extension = extname(originalName).toLowerCase();
    const truncated = name.slice(0, 200);
    return `${prefix}_${uniqueId}_${truncated}${extension}`;
}
