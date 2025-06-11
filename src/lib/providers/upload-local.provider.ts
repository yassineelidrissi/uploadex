import { Inject, Injectable } from '@nestjs/common';
import { cleanupFile, mapFile, validateFile, validateFiles } from '../helpers/upload-validation.helper';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';
import { UploadexError } from '../errors/uploadex-error';

@Injectable()
export class UploadLocalProvider implements UploadProvider {

    constructor(
        @Inject(UploadOptionsToken)
        private readonly options: UploadModuleOptions<'local'>
    ) {}

    public async handleSingleFileUpload(file: Express.Multer.File) {
        if (!file) throw new UploadexError('UNKNOWN', 'No file uploaded');

        try {
            await validateFile(file, {
                maxSize: this.options.maxFileSize,
                allowedExtensions: this.options.allowedExtensions,
                allowedMimeTypes: this.options.allowedMimeTypes
            });
            return mapFile(file);
        } catch (error) {
            await cleanupFile(file.path);
            if (error instanceof UploadexError) {
                throw error;
            }
            throw new UploadexError('UNKNOWN', 'Unexpected error in local upload provider', { cause: error });
        }
    }

    public async handleMultipleFileUpload(files: Express.Multer.File[]) {
        if (!files?.length) throw new UploadexError('UNKNOWN', 'No files uploaded');

        try {
            await validateFiles(files, {
                maxFiles: this.options.maxFiles,
                maxSize: this.options.maxFileSize,
                allowedExtensions: this.options.allowedExtensions,
                allowedMimeTypes: this.options.allowedMimeTypes
            });

            const uploaded = await Promise.all(files.map(file => mapFile(file)));

            return uploaded;
        } catch (error) {
            await Promise.all(
                files.filter(f => f.path).map(f => cleanupFile(f.path))
            );
            if (error instanceof UploadexError) {
                throw error;
            }
            throw new UploadexError('UNKNOWN', 'Unexpected error in local upload provider', { cause: error });
        }
    }

}