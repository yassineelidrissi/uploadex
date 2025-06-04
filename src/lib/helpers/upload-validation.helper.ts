import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { promises as fs } from 'fs';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from '../constants/upload.constants';
import { FileValidationOptions } from '../interfaces/file-validation-options.interface';

async function validateFileContent(file: Express.Multer.File) {
    if (file.mimetype.startsWith('image/')) {
        // 
    }
}

export async function validateFile(file: Express.Multer.File, options: FileValidationOptions) {

    const { maxSize = 5 * 1024 * 1024, allowedExtensions = ALLOWED_EXTENSIONS, allowedMimeTypes = ALLOWED_MIME_TYPES } = options;

    const fileExt = extname(file.originalname).toLowerCase();

    if(file.size > maxSize)
        throw new BadRequestException(`Max file size is ${maxSize / 1024 / 1024}MB`);

    if(!allowedExtensions.includes(fileExt))
        throw new BadRequestException(`Invalid file extension: ${fileExt}`);

    if(!allowedMimeTypes.includes(file?.mimetype))
        throw new BadRequestException(`Invalid MIME type: ${file.mimetype}`);
    
    await validateFileContent(file);
}

export async function validateFiles(files: Express.Multer.File[], options: FileValidationOptions = {}): Promise<void> {
    const { maxFiles = 5 } = options;

    if (!files?.length) {
        throw new BadRequestException('No files uploaded');
    }

    if (files.length > maxFiles) {
        throw new BadRequestException(`You can upload a maximum of ${maxFiles} files`);
    }

    await Promise.all(files.map((file) => validateFile(file, options)));
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
        console.error(`Cleanup failed for ${filePath}: ${error.message}`);
    }
}