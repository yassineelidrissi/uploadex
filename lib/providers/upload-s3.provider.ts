import { Inject, Injectable } from '@nestjs/common';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, BucketLocationConstraint } from '@aws-sdk/client-s3';
import { cleanupFile, validateFile, validateFiles } from '../helpers/upload-validation.helper';
import * as fs from 'fs';
import { UploadexError } from '../errors/uploadex-error';
import { safeUpload } from '../helpers/safe-upload.helper';
import { UploadedFileMeta } from '../interfaces/uploaded-file-meta.interface';
import { generateSafeFilename } from '../helpers/filename.helper';
import { shouldUseBuffer } from '../helpers/buffer-hydration.helper';
import { configureUploadexLogger, uploadexLogger } from '../utils/uploadex.logger';

@Injectable()
export class UploadS3Provider implements UploadProvider {
    private readonly s3: S3Client;
    private readonly bucket: string;
    private readonly region: string;
    private readonly maxSafeMemorySize: number;
    private readonly timeoutMs?: number;
    private readonly retries?: number;
    private readonly checkBucket?: boolean;

    constructor(
        @Inject(UploadOptionsToken)
        private readonly options: UploadModuleOptions<'s3'>,
    ) {
        if (options.provider !== 's3') return;

        configureUploadexLogger(options.debug ?? false);

        const config = this.options.config;
        this.bucket = config.bucket;
        this.region = config.region;
        this.maxSafeMemorySize = this.options.maxSafeMemorySize ?? 10 * 1024 * 1024;
        this.timeoutMs = this.options.uploadTimeoutMs;
        this.retries = this.options.uploadRetries;
        this.checkBucket = config.checkBucket ?? false;

        if (!config.region || !config.bucket || !config.accessKeyId || !config.secretAccessKey) {
            throw new UploadexError(
              'CONFIGURATION_ERROR',
              'S3 config is missing region, bucket, accessKeyId, or secretAccessKey'
            );
        }

        this.s3 = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
            ...(config.endpoint
                ? {
                    endpoint: config.endpoint,
                    forcePathStyle: true,
                }
                : {}),
        });

        // If using LocalStack, auto create bucket
        if (this.checkBucket) {
            this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }))
            .then(() => {
                uploadexLogger.debug(`[S3] Bucket "${this.bucket}" exists`, 'S3Provider');
            })
            .catch(async (err) => {
                uploadexLogger.warn(`[S3] Bucket "${this.bucket}" not found, creating...`, 'S3Provider');
                try {
                    await this.s3.send(
                        new CreateBucketCommand({
                            Bucket: this.bucket,
                            ...(this.region !== 'us-east-1' && {
                                CreateBucketConfiguration: {
                                    LocationConstraint: this.region as BucketLocationConstraint,
                                },
                            }),
                        })
                    );
                    uploadexLogger.debug(`[S3] Bucket created: "${this.bucket}"`, 'S3Provider');
                } catch (createErr) {
                    uploadexLogger.error(`[S3] Failed to create bucket "${this.bucket}": ${createErr.message}`, undefined, 'S3Provider');
                    throw new UploadexError('CONFIGURATION_ERROR', `S3 bucket check or creation failed`, { cause: createErr });
                }
            });
        }

    }

    private getS3Url(key: string): string {
        const endpoint = this.options.config.endpoint;
        return endpoint
            ? endpoint.replace('localstack', 'localhost') + `/${this.bucket}/${key}`
            : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }

    public async handleSingleFileUpload(file: Express.Multer.File): Promise<UploadedFileMeta> {
        if (!file) throw new UploadexError('UNKNOWN', 'No file uploaded');

        await validateFile(file, {
            maxSize: this.options.maxFileSize,
            allowedExtensions: this.options.allowedExtensions,
            allowedMimeTypes: this.options.allowedMimeTypes,
        });

        const key = generateSafeFilename(file.originalname, 's3');

        const task = async () => {
            const useBuffer = await shouldUseBuffer(file, this.maxSafeMemorySize);

            uploadexLogger.debug(`Uploading "${file.originalname}" using ${useBuffer ? 'buffer' : 'stream'}...`, 'S3Provider');

            if (useBuffer && file.buffer) {
                await this.s3.send(
                    new PutObjectCommand({
                        Bucket: this.bucket,
                        Key: key,
                        Body: file.buffer,
                        ContentType: file.mimetype,
                    }),
                );
            } else if (file.path) {
                const fileStream = fs.createReadStream(file.path);

                await this.s3.send(
                    new PutObjectCommand({
                        Bucket: this.bucket,
                        Key: key,
                        Body: fileStream,
                        ContentType: file.mimetype,
                    }),
                );

            } else {
                throw new UploadexError('UNKNOWN', 'No valid file buffer or path');
            }

            uploadexLogger.debug(`Upload successful: ${key}`, 'S3Provider');

            return {
                fileName: file.originalname,
                storedName: key,
                filePath: this.getS3Url(key),
                mimeType: file.mimetype,
                size: file.size,
            };
        };

        try {
            const result = await safeUpload(task, {
                timeoutMs: this.timeoutMs,
                retries: this.retries,
                onCleanup: async () => {
                    if (file.path) await cleanupFile(file.path);
                },
            });

            if (file.path) await cleanupFile(file.path);
            return result;
        } catch (error) {
            uploadexLogger.error(`Single file upload failed: ${error.message}`, undefined, 'S3Provider');
            throw error instanceof UploadexError
            ? error
            : new UploadexError('UNKNOWN', `S3 upload failed: ${error.message}`, { cause: error });
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

            const uploaded: UploadedFileMeta[] = [];

            const uploadTasks = files.map(async (file) => {
                const key = generateSafeFilename(file.originalname, 's3');

                const task = async () => {
                    const useBuffer = await shouldUseBuffer(file, this.maxSafeMemorySize);

                    uploadexLogger.debug(`Uploading "${file.originalname}" using ${useBuffer ? 'buffer' : 'stream'}...`, 'S3Provider');

                    if (useBuffer && file.buffer) {
                        await this.s3.send(
                            new PutObjectCommand({
                                Bucket: this.bucket,
                                Key: key,
                                Body: file.buffer,
                                ContentType: file.mimetype,
                            }),
                        );
                    } else if (file.path) {
                        const fileStream = fs.createReadStream(file.path);
                        await this.s3.send(
                            new PutObjectCommand({
                                Bucket: this.bucket,
                                Key: key,
                                Body: fileStream,
                                ContentType: file.mimetype,
                            }),
                        );
                    } else {
                        throw new UploadexError('UNKNOWN', 'No valid file buffer or path');
                    }

                    uploadexLogger.debug(`Upload successful: ${key}`, 'S3Provider');

                    return {
                        fileName: file.originalname,
                        storedName: key,
                        filePath: this.getS3Url(key),
                        mimeType: file.mimetype,
                        size: file.size,
                    };
                };

                const result = await safeUpload(task, {
                    timeoutMs: this.timeoutMs,
                    retries: this.retries,
                    onCleanup: async () => {
                        if (file.path) await cleanupFile(file.path);
                    },
                });

                if (file.path) await cleanupFile(file.path);
                uploaded.push(result);
            });

            await Promise.all(uploadTasks);
            return uploaded;
        } catch (error) {
            uploadexLogger.error(`Multiple file upload failed: ${error.message}`, undefined, 'S3Provider');
            await Promise.all(files.filter((f) => f?.path).map((f) => cleanupFile(f.path)));

            throw error instanceof UploadexError
            ? error
            : new UploadexError('UNKNOWN', `Multiple S3 upload failed: ${error.message}`, { cause: error });
        }
    }
    
}
