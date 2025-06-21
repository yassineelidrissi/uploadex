import { Inject, Injectable } from '@nestjs/common';
import { Storage, GetSignedUrlConfig } from '@google-cloud/storage';
import * as fs from 'fs';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';
import { UploadexError } from '../errors/uploadex-error';
import { UploadedFileMeta } from '../interfaces/uploaded-file-meta.interface';
import { generateSafeFilename } from '../helpers/filename.helper';
import { validateFile, validateFiles, cleanupFile } from '../helpers/upload-validation.helper';
import { safeUpload } from '../helpers/safe-upload.helper';
import { shouldUseBuffer } from '../helpers/buffer-hydration.helper';
import { configureUploadexLogger, uploadexLogger } from '../utils/uploadex.logger';

@Injectable()
export class UploadGCSProvider implements UploadProvider {
    private readonly storage: Storage;
    private readonly bucketName: string;
    private readonly endpoint?: string;
    private readonly emulatorMode: boolean;
    private readonly maxSafeMemorySize: number;
    private readonly timeoutMs?: number;
    private readonly retries?: number;

    constructor(
        @Inject(UploadOptionsToken)
        private readonly options: UploadModuleOptions<'gcs'>
    ) {
        if (options.provider !== 'gcs') return;

        configureUploadexLogger(options.debug ?? false);

        const config = options.config;
        this.bucketName = config.bucket;
        this.endpoint = config.endpoint;
        this.emulatorMode = !!config.endpoint;
        this.maxSafeMemorySize = options.maxSafeMemorySize ?? 10 * 1024 * 1024;
        this.timeoutMs = options.uploadTimeoutMs;
        this.retries = options.uploadRetries;

        this.storage = new Storage({
            projectId: config.projectId,
            ...(config.keyFilename ? { keyFilename: config.keyFilename } : {}),
            ...(config.endpoint ? { apiEndpoint: config.endpoint } : {}),
        });
    }

    private async getBucket() {
        const bucket = this.storage.bucket(this.bucketName);
        const [exists] = await bucket.exists();

        if (!exists && this.emulatorMode) {
            try {
                await bucket.create();
                console.log('[GCS] Bucket created:', this.bucketName);
                uploadexLogger.debug(`[GCS] Bucket created: "${this.bucketName}"`, 'GCSProvider');
            } catch (error) {
                console.error('[GCS] Failed to create bucket:', error);
                throw new UploadexError('UNKNOWN', 'Bucket creation failed', { cause: error });
            }
        }

        return bucket;
    }

    private async getFileUrl(blobName: string): Promise<string> {
        if (this.emulatorMode && this.endpoint) {
            const base = this.endpoint
            .replace('gcs-emulator', 'localhost')
            .replace(/\/+$/, '');

            return `${base}/storage/v1/b/${this.bucketName}/o/${encodeURIComponent(blobName)}?alt=media`;
        }

        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(blobName);
            const options: GetSignedUrlConfig = {
                version: 'v4',
                action: 'read',
                expires: Date.now() + 60 * 60 * 1000,
            };

            const [url] = await file.getSignedUrl(options);
            return url;
        } catch (error) {
            throw new UploadexError('UNKNOWN', 'Failed to generate signed URL', { cause: error });
        }
    }
  
  

    private async uploadFile(file: Express.Multer.File, key: string, contentType: string): Promise<void> {
        const bucket = await this.getBucket();
        const blob = bucket.file(key);
        const useBuffer = await shouldUseBuffer(file, this.maxSafeMemorySize);

        uploadexLogger.debug(`Uploading "${file.originalname}" using ${useBuffer ? 'buffer' : 'stream'}...`, 'GCSProvider');

        if (useBuffer && file.buffer) {
            await blob.save(file.buffer, { contentType });
            uploadexLogger.debug(`Upload successful (buffer): ${key}`, 'GCSProvider');
        } else if (file.path) {
            const stream = fs.createReadStream(file.path);
            await new Promise((resolve, reject) => {
            stream
                .pipe(blob.createWriteStream({ contentType }))
                .on('finish', () => {
                    uploadexLogger.debug(`Upload successful (stream): ${key}`, 'GCSProvider');
                    resolve(undefined);
                })
                .on('error', (error) => {
                    uploadexLogger.error(`Stream upload failed: ${error.message}`, undefined, 'GCSProvider');
                    reject(new UploadexError('UNKNOWN', 'Stream write failed', { cause: error }));
                });
            });
        } else {
            throw new UploadexError('UNKNOWN', 'No valid file buffer or path');
        }
    }

    public async handleSingleFileUpload(file: Express.Multer.File): Promise<UploadedFileMeta> {
        if (!file) throw new UploadexError('UNKNOWN', 'No file uploaded');

        try {
            await validateFile(file, {
                maxSize: this.options.maxFileSize,
                allowedExtensions: this.options.allowedExtensions,
                allowedMimeTypes: this.options.allowedMimeTypes,
            });

            const key = generateSafeFilename(file.originalname, 'gcs');

            const result = await safeUpload(async () => {
                await this.uploadFile(file, key, file.mimetype);
                const url = await this.getFileUrl(key);

                return {
                    fileName: file.originalname,
                    storedName: key,
                    filePath: url,
                    mimeType: file.mimetype,
                    size: file.size,
                };
            }, {
                timeoutMs: this.timeoutMs,
                retries: this.retries,
                onCleanup: async () => {
                    if (file.path) await cleanupFile(file.path);
                },
            });

            if (file.path) await cleanupFile(file.path);
            return result;

        } catch (error) {
            if (file?.path) await cleanupFile(file.path);
            uploadexLogger.error(`Single file upload failed: ${error.message}`, undefined, 'GCSProvider');
            throw error instanceof UploadexError
            ? error
            : new UploadexError('UNKNOWN', `GCS single upload failed: ${error.message}`, { cause: error });
        }
    }

    public async handleMultipleFileUpload(files: Express.Multer.File[]): Promise<UploadedFileMeta[]> {
        if (!files?.length) throw new UploadexError('UNKNOWN', 'No files uploaded');

        await validateFiles(files, {
            maxFiles: this.options.maxFiles,
            maxSize: this.options.maxFileSize,
            allowedExtensions: this.options.allowedExtensions,
            allowedMimeTypes: this.options.allowedMimeTypes,
        });

        const uploaded: UploadedFileMeta[] = [];

        const tasks = files.map(async (file) => {
            const key = generateSafeFilename(file.originalname, 'gcs');

            const result = await safeUpload(async () => {
                await this.uploadFile(file, key, file.mimetype);
                const url = await this.getFileUrl(key);

                return {
                    fileName: file.originalname,
                    storedName: key,
                    filePath: url,
                    mimeType: file.mimetype,
                    size: file.size,
                };
                }, {
                    timeoutMs: this.timeoutMs,
                    retries: this.retries,
                    onCleanup: async () => {
                        if (file.path) await cleanupFile(file.path);
                    },
            });

            if (file.path) await cleanupFile(file.path);
            uploaded.push(result);
        });

        try {
            await Promise.all(tasks);
            return uploaded;
        } catch (error) {
            await Promise.all(files.filter(f => f?.path).map(f => cleanupFile(f.path)));
            uploadexLogger.error(`Multiple file upload failed: ${error.message}`, undefined, 'GCSProvider');
            throw error instanceof UploadexError
            ? error
            : new UploadexError('UNKNOWN', `Multiple GCS upload failed: ${error.message}`, { cause: error });
        }
    }
}