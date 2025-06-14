import { basename, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a sanitized and unique filename using the original name and UUID.
 * Replaces spaces/special characters
 */
export function generateSafeFilename(originalName: string, prefix = 'upload'): string {
    if (!originalName || typeof originalName !== 'string') return 'file';
    
    const uniqueId = uuidv4();
    const extension = extname(originalName).toLowerCase();
    const name = basename(originalName, extension)
        .toLowerCase()
        .replace(/[^a-z0-9\-_.]/g, '-')  // Keep only safe characters
        .replace(/-+/g, '-')             // Collapse repeated dashes
        .replace(/^-+|-+$/g, '')         // Trim dashes
        .slice(0, 100);                  

    return `${prefix}-${uniqueId}-${name}${extension}`;
}
