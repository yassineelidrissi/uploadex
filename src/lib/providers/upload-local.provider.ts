import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { cleanupFile, mapFile, validateFile } from '../helpers/upload-validation.helper';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';

@Injectable()
export class UploadLocalProvider implements UploadProvider {

    constructor(
        @Inject(UploadOptionsToken)
        private readonly options: UploadModuleOptions<'local'>
    ) {}

    public async handleSingleFileUpload(file: Express.Multer.File) {
        if (!file) throw new BadRequestException('No file uploaded');

        try {
            const maxSize = this.options.maxFileSize ?? 5 * 1024 * 1024;

            await validateFile(file, maxSize);
            return mapFile(file);
        } catch (error) {
            await cleanupFile(file.path);
            throw new InternalServerErrorException(`Upload failed: ${error.message}`);
        }
    }

    public async handleMultipleFileUpload(files: Express.Multer.File[]) {
        if (!files?.length) throw new BadRequestException('No files uploaded');
        const uploaded: any[] = [];

        try {
            const maxSize = this.options.maxFileSize ?? 5 * 1024 * 1024;

            for (const file of files) {
                await validateFile(file, maxSize);
                uploaded.push(mapFile(file));
            }
            return uploaded;
        } catch (error) {
            await Promise.all(files.map(f => cleanupFile(f.path)));
            throw new InternalServerErrorException(`Upload failed: ${error.message}`);
        }
    }

}