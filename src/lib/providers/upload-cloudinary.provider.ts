import { Inject, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';
import { unlink } from 'fs/promises';

@Injectable()
export class UploadCloudinaryProvider implements UploadProvider {

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
    }

    public async handleSingleFileUpload(file: Express.Multer.File): Promise<any> {

       try {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: 'uploads',
                resource_type: 'auto',
            });

            return {
                fileName: result.original_filename,
                filePath: result.secure_url,
                mimeType: file.mimetype,
                size: file.size,
            };
       } finally {
            try {
                await unlink(file.path);
            } catch (error) {
                console.warn(`Failed to delete local file: ${file.path}`, error.message);
            }
       }
    }

    public async handleMultipleFileUpload(files: Express.Multer.File[]): Promise<any[]> {
        const uploaded: any[] = [];
        for (const file of files) {
            const uploadedFile = await this.handleSingleFileUpload(file);
            uploaded.push(uploadedFile);
        }
        return uploaded;
    }
}