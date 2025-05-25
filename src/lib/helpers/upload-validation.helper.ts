import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { promises as fs } from 'fs';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from '../constants/upload.constants';

async function validateFileContent(file: Express.Multer.File) {
    if (file.mimetype.startsWith('image/')) {
        // 
    }
}

export async function validateFile(file: Express.Multer.File, maxSize: number) {

    const fileExt = extname(file.originalname).toLowerCase();

    if(file.size > maxSize)
        throw new BadRequestException(`Max file size is ${maxSize / 1024 / 1024}MB`);

    if(!ALLOWED_EXTENSIONS.includes(fileExt))
        throw new BadRequestException(`Invalid file extension: ${fileExt}`);

    if(!ALLOWED_MIME_TYPES.includes(file?.mimetype))
        throw new BadRequestException(`Invalid MIME type: ${file.mimetype}`);
    
    await validateFileContent(file);
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