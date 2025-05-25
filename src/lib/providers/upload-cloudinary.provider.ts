import { Inject, Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';

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
        const uniqueFilename = `${uuidv4()}-${file.originalname}`;
        const tempPath = path.join(process.cwd(), 'temp', uniqueFilename);
        await fs.mkdir(path.dirname(tempPath), { recursive: true });
        await fs.writeFile(tempPath, file.buffer);

        try {
            const result = await cloudinary.uploader.upload(tempPath, {
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
            await fs.unlink(tempPath);
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

