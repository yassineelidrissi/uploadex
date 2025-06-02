import { Inject, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';
import { Readable } from 'stream';

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

    private async streamUpload(fileBuffer: Buffer): Promise<any> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream({
                folder: 'uploads',
                resource_type: 'auto',
                },
                (error, result) => {
                    if (error) {
                        console.error('[Cloudinary Error]', error);
                        return reject(error);
                    }
                    resolve(result);
                }
            );

            const readable = Readable.from(fileBuffer);
            readable.on('error', reject);
            readable.pipe(uploadStream);
        });
    }

    public async handleSingleFileUpload(file: Express.Multer.File): Promise<any> {

        const result = await this.streamUpload(file.buffer);

        return {
            fileName: file.originalname,
            filePath: result.secure_url,
            mimeType: file.mimetype,
            size: file.size,
        };
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