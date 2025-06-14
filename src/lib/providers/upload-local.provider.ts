import { Inject, Injectable } from '@nestjs/common';
import { cleanupFile, validateFile, validateFiles } from '../helpers/upload-validation.helper';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';
import { UploadexError } from '../errors/uploadex-error';
import { resolve } from 'path';
import * as fs from 'fs';
import { UploadedFileMeta } from '../interfaces/uploaded-file-meta.interface';
import { safeUpload } from '../helpers/safe-upload.helper';
import { pipeline } from 'stream/promises';
import { generateSafeFilename } from '../helpers/filename.helper';

@Injectable()
export class UploadLocalProvider implements UploadProvider {
    private readonly maxSafeMemorySize: number;
    private readonly timeoutMs?: number;
    private readonly retries?: number;
    private readonly uploadPath: string;

    constructor(
        @Inject(UploadOptionsToken)
        private readonly options: UploadModuleOptions<'local'>,
    ) {
        this.maxSafeMemorySize = this.options.maxSafeMemorySize ?? 10 * 1024 * 1024;
        this.timeoutMs = this.options.uploadTimeoutMs;
        this.retries = this.options.uploadRetries;
        this.uploadPath = resolve(
            process.cwd(),
            (this.options.config as any).uploadPath || './uploadex-temp',
        );
    }

    private async streamToLocal(file: Express.Multer.File, outputPath: string): Promise<UploadedFileMeta> {
        const writeStream = fs.createWriteStream(outputPath);
    
        if (!file.path && file.buffer) {
            await fs.promises.writeFile(outputPath, file.buffer);
        } else if (file.path) {
            const readStream = fs.createReadStream(file.path);
            await pipeline(readStream, writeStream);
        } else {
            throw new UploadexError('UNKNOWN', 'No valid buffer or path to stream');
        }
    
        return {
            fileName: file.originalname,
            storedName: outputPath.split('/').pop()!,
            filePath: outputPath,
            mimeType: file.mimetype,
            size: file.size,
        };
    }
    

    public async handleSingleFileUpload(file: Express.Multer.File): Promise<UploadedFileMeta> {
        if (!file) throw new UploadexError('UNKNOWN', 'No file uploaded');

        try {
            await validateFile(file, {
                maxSize: this.options.maxFileSize,
                allowedExtensions: this.options.allowedExtensions,
                allowedMimeTypes: this.options.allowedMimeTypes,
            });

            const outputPath = resolve(this.uploadPath, generateSafeFilename(file.originalname, 'local'));

            // const sanitizedName = sanitizeOriginalName(file.originalname);

            const result = await safeUpload(() => this.streamToLocal(file, outputPath), {
                timeoutMs: this.timeoutMs,
                retries: this.retries,
                onCleanup: async () => {
                    if (file?.path) await cleanupFile(file.path);
                },
            });

            if (file?.path) await cleanupFile(file.path);

            return result;
        } catch (error) {
            throw error instanceof UploadexError
            ? error
            : new UploadexError('UNKNOWN', 'Unexpected error in local upload provider', { cause: error });
        }
    }

    public async handleMultipleFileUpload(files: Express.Multer.File[]): Promise<UploadedFileMeta[]> {
        if (!files?.length)
            throw new UploadexError('UNKNOWN', 'No files uploaded');

        try {
            await validateFiles(files, {
                maxFiles: this.options.maxFiles,
                maxSize: this.options.maxFileSize,
                allowedExtensions: this.options.allowedExtensions,
                allowedMimeTypes: this.options.allowedMimeTypes,
            });

            const uploaded: UploadedFileMeta[] = [];

            const tasks = files.map(async (file) => {
                const outputPath = resolve(this.uploadPath, generateSafeFilename(file.originalname, 'local'));

                // const sanitizedName = sanitizeOriginalName(file.originalname);

                const result = await safeUpload(() => this.streamToLocal(file, outputPath), {
                    timeoutMs: this.timeoutMs,
                    retries: this.retries,
                    onCleanup: async () => {
                        if (file?.path) await cleanupFile(file.path);
                    },
                });

                if (file?.path) await cleanupFile(file.path);
                uploaded.push(result);
            });

            await Promise.all(tasks);
            return uploaded;
        } catch (error) {
            await Promise.all(
                files.filter((f) => f?.path).map((f) => cleanupFile(f.path)),
            );

            throw error instanceof UploadexError
            ? error
            : new UploadexError('UNKNOWN', 'Unexpected error in local upload provider', { cause: error });
        }
    }
}