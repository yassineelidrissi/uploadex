import { Inject, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';
import { Readable } from 'stream';
import * as fs from 'fs';
import { cleanupFile, validateFile, validateFiles } from '../helpers/upload-validation.helper';
import { UploadexError } from '../errors/uploadex-error';
import { safeUpload } from '../helpers/safe-upload.helper';
import { UploadedFileMeta } from '../interfaces/uploaded-file-meta.interface';
import { generateSafeFilename } from '../helpers/filename.helper';
import { extname } from 'path';

@Injectable()
export class UploadCloudinaryProvider implements UploadProvider {
    private readonly maxSafeMemorySize: number;
    private readonly timeoutMs?: number;
    private readonly retries?: number;

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
        this.timeoutMs = this.options.uploadTimeoutMs;
        this.retries = this.options.uploadRetries;
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

    private async streamUploadFilePath(file: Express.Multer.File, publicId: string): Promise<any> {
    
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'uploads', public_id: publicId, resource_type: 'auto' },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
    
            const fileStream = fs.createReadStream(file.path);
            fileStream.on('error', reject);
            fileStream.pipe(uploadStream);
        });
    }

    public async handleSingleFileUpload(file: Express.Multer.File): Promise<UploadedFileMeta> {
        if (!file) throw new UploadexError('UNKNOWN', 'No file uploaded');

        const publicId = generateSafeFilename(file.originalname, 'cloud').replace(/\.[^/.]+$/, '');
        
        try {
            await validateFile(file, {
                maxSize: this.options.maxFileSize,
                allowedExtensions: this.options.allowedExtensions,
                allowedMimeTypes: this.options.allowedMimeTypes,
            });
        
            const task = () => {
                if (file.size <= this.maxSafeMemorySize && file.buffer) {
                    return this.streamUploadBuffer(file.buffer);
                } else if (file.path) {
                    return this.streamUploadFilePath(file, publicId);
                } else {
                    throw new UploadexError('UNKNOWN', 'Unsupported file format: no valid buffer or path.');
                }
            };
        
            const result = await safeUpload(task, {
                timeoutMs: this.timeoutMs,
                retries: this.retries,
                onCleanup: async () => {
                    if (file.path) await cleanupFile(file.path);
                },
            });
        
            if (file.path) await cleanupFile(file.path);
        
            return {
                fileName: file.originalname,
                storedName: publicId + extname(file.originalname),
                filePath: result.secure_url,
                mimeType: file.mimetype,
                size: file.size,
            };
        
        } catch (error) {
            throw error instanceof UploadexError
            ? error
            : new UploadexError('UNKNOWN', `Cloudinary upload failed: ${error.message}`, { cause: error });
        }
    }
      

    public async handleMultipleFileUpload(files: Express.Multer.File[]): Promise<UploadedFileMeta[]> {
        if (!files?.length) throw new UploadexError('UNKNOWN', 'No files uploaded');
        
        try {
            await validateFiles(files, {
                maxFiles: this.options.maxFiles,
                maxSize: this.options.maxFileSize,
                allowedExtensions: this.options.allowedExtensions,
                allowedMimeTypes: this.options.allowedMimeTypes,
            });
        
            const uploaded: any[] = [];
        
            const uploadTasks = files.map(async (file) => {
                const publicId = generateSafeFilename(file.originalname, 'cloud').replace(/\.[^/.]+$/, '');

                const task = () => {
                    if (file.size <= this.maxSafeMemorySize && file.buffer) {
                        return this.streamUploadBuffer(file.buffer);
                    } else if (file.path) {
                        return this.streamUploadFilePath(file, publicId);
                    } else {
                        throw new UploadexError('UNKNOWN', 'Unsupported file format: no valid buffer or path.');
                    }
                };
        
                const result = await safeUpload(task, {
                    timeoutMs: this.timeoutMs,
                    retries: this.retries,
                    onCleanup: async () => {
                        if (file.path) await cleanupFile(file.path);
                    },
                });
            
                if (file.path) await cleanupFile(file.path);
            
                uploaded.push({
                    fileName: file.originalname,
                    storedName: publicId + extname(file.originalname),
                    filePath: result.secure_url,
                    mimeType: file.mimetype,
                    size: file.size,
                });
            });
        
            await Promise.all(uploadTasks);
            return uploaded;
        } catch (error) {
            await Promise.all(
                files.filter(f => f?.path).map(f => cleanupFile(f.path))
            );
        
            throw error instanceof UploadexError
                ? error
                : new UploadexError('UNKNOWN', `Multiple Cloudinary upload failed: ${error.message}`, { cause: error });
        }
    }
      
}