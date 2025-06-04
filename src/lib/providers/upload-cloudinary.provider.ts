import { Inject, Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';
import { Readable } from 'stream';
import * as fs from 'fs';
import { cleanupFile, validateFile, validateFiles } from '../helpers/upload-validation.helper';

@Injectable()
export class UploadCloudinaryProvider implements UploadProvider {
    private readonly maxSafeMemorySize: number;

    constructor(
        @Inject(UploadOptionsToken)
        private readonly options: UploadModuleOptions<'cloudinary'>
    ) {
        const cloudinaryConfig = this.options.config;

        cloudinary.config({
            cloud_name: cloudinaryConfig.cloudName,
            api_key: cloudinaryConfig.apiKey,
            api_secret: cloudinaryConfig.apiSecret,
        });

        this.maxSafeMemorySize = this.options.maxSafeMemorySize ?? 10 * 1024 * 1024;
    }

    private async streamUploadBuffer(fileBuffer: Buffer): Promise<any> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'uploads', resource_type: 'auto' },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );

            const readable = Readable.from(fileBuffer);
            readable.on('error', reject);
            readable.pipe(uploadStream);
        });
    }

    private async streamUploadFilePath(filePath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'uploads', resource_type: 'auto' },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );

            const fileStream = fs.createReadStream(filePath);
            fileStream.on('error', reject);
            fileStream.pipe(uploadStream);
        });
    }

    public async handleSingleFileUpload(file: Express.Multer.File): Promise<any> {
        if (!file) throw new BadRequestException('No file uploaded');

        try {
            await validateFile(file, {
                maxSize: this.options.maxFileSize,
                allowedExtensions: this.options.allowedExtensions,
                allowedMimeTypes: this.options.allowedMimeTypes
            });

            let result: any;
            if (file.size <= this.maxSafeMemorySize && file.buffer) {
                result = await this.streamUploadBuffer(file.buffer);
            } else if (file.path) {
                result = await this.streamUploadFilePath(file.path);
                await cleanupFile(file.path);
            } else {
                throw new Error('Unsupported file format: no valid buffer or path.');
            }

            return {
                fileName: file.originalname,
                filePath: result.secure_url,
                mimeType: file.mimetype,
                size: file.size,
            };

        } catch (error) {
            if (file?.path) await cleanupFile(file.path);
            throw new InternalServerErrorException(`Cloudinary upload failed: ${error.message}`);
        }
    }

    public async handleMultipleFileUpload(files: Express.Multer.File[]): Promise<any[]> {
        if (!files?.length) throw new BadRequestException('No files uploaded');
        
        try {
            await validateFiles(files, {
                maxFiles: this.options.maxFiles,
                maxSize: this.options.maxFileSize,
                allowedExtensions: this.options.allowedExtensions,
                allowedMimeTypes: this.options.allowedMimeTypes,
            });
    
            const uploaded: any[] = [];
    
            const uploadTasks = files.map(async (file) => {
                let result: any;
                if (file.size <= this.maxSafeMemorySize && file.buffer) {
                    result = await this.streamUploadBuffer(file.buffer);
                } else if (file.path) {
                    result = await this.streamUploadFilePath(file.path);
                    await cleanupFile(file.path);
                } else {
                    throw new Error('Unsupported file format');
                }
    
                uploaded.push({
                    fileName: file.originalname,
                    filePath: result.secure_url,
                    mimeType: file.mimetype,
                    size: file.size,
                });
            });
    
            await Promise.all(uploadTasks);
            return uploaded;
        } catch (error) {
            await Promise.all(files.map(f => cleanupFile(f.path)));
            throw new InternalServerErrorException(`Multiple file upload failed: ${error.message}`);
        }
    }
}