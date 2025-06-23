import { extname } from 'path';
import { promises as fs } from 'fs';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from '../constants/upload.constants';
import { FileValidationOptions } from '../interfaces/file-validation-options.interface';
import { UploadexError } from '../errors/uploadex-error';
import { MulterError } from 'multer';
import { UploadConfigStorage } from '../utils/upload-config.storage';

async function validateFileContent(file: Express.Multer.File) {
    if (file.mimetype.startsWith('image/')) {
        // 
    }
}

export async function validateFile(file: Express.Multer.File, options: FileValidationOptions) {

    const {
        maxSize = 5 * 1024 * 1024,
        allowedExtensions = ALLOWED_EXTENSIONS,
        allowedMimeTypes = ALLOWED_MIME_TYPES
    } = options;

    const fileExt = extname(file.originalname).toLowerCase();

    if (file.size > maxSize)
        throw new UploadexError('FILE_TOO_LARGE', `Max file size is ${maxSize / 1024 / 1024}MB`, { fileSize: file.size, maxSize });

    if (!allowedExtensions.includes(fileExt))
        throw new UploadexError('INVALID_EXTENSION', `Invalid file extension: ${fileExt}`, { extension: fileExt });

    if (!allowedMimeTypes.includes(file.mimetype))
        throw new UploadexError('INVALID_MIME_TYPE', `Invalid MIME type: ${file.mimetype}`, { mimeType: file.mimetype });
    
    await validateFileContent(file);
}

export async function validateFiles(files: Express.Multer.File[], options: FileValidationOptions = {}): Promise<void> {
    const { maxFiles = 10 } = options;

    if (!files?.length) throw new UploadexError('UNKNOWN', 'No files uploaded');

    if (files.length > maxFiles) {
        throw new UploadexError('MAX_FILES_EXCEEDED', `You can upload a maximum of ${maxFiles} files`, { count: files.length });
    }

    await Promise.all(files.map(file => validateFile(file, options)));
}

export function mapFile(file: Express.Multer.File) {
    return {
        fileName: file.filename,
        filePath: file.path,
        mimeType: file.mimetype,
        size: file.size,
    };
}

export async function cleanupFile(filePath: string) {
    try {
        await fs.unlink(filePath);
    } catch (error) {
        console.warn(`Cleanup failed for ${filePath}: ${error.message}`);
    }
}

export function transformMulterError(error: any): Error {
    const config = UploadConfigStorage.get();
    const debug = config?.debug === true;

    if (error instanceof MulterError) {
        const baseDetails = debug ? { cause: error } : undefined;

        switch (error.code) {
        case 'LIMIT_FILE_SIZE':
            return new UploadexError('FILE_TOO_LARGE', 'File too large', {
                maxFileSize: config.maxFileSize,
                ...baseDetails,
            });

        case 'LIMIT_FILE_COUNT':
            return new UploadexError('MAX_FILES_EXCEEDED', 'Too many files uploaded', {
                maxFiles: config.maxFiles,
                ...baseDetails,
            });

        case 'LIMIT_UNEXPECTED_FILE':
            return new UploadexError('INVALID_EXTENSION', 'Unexpected file field received', {
                ...baseDetails,
            });

        default:
            return new UploadexError('UNKNOWN', error.message || 'Unknown Multer error', {
                ...baseDetails,
            });
        }
    }

    return error;
}