import { Inject, Injectable } from '@nestjs/common';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  SASProtocol,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import * as fs from 'fs';
import { validateFile, validateFiles } from '../helpers/upload-validation.helper';
import { UploadexError } from '../errors/uploadex-error';
import { safeUpload } from '../helpers/safe-upload.helper';
import { UploadedFileMeta } from '../interfaces/uploaded-file-meta.interface';
import { generateSafeFilename } from '../helpers/filename.helper';
import { cleanupFile } from '../helpers/upload-validation.helper';
import { shouldUseBuffer } from '../helpers/buffer-hydration.helper';
import { configureUploadexLogger, uploadexLogger } from '../utils/uploadex.logger';

@Injectable()
export class UploadAzureProvider implements UploadProvider {
    private readonly client: BlobServiceClient;
    private readonly containerName: string;
    private readonly accountName: string;
    private readonly accountKey: string;
    private readonly endpoint?: string;
    private readonly maxSafeMemorySize: number;
    private readonly timeoutMs?: number;
    private readonly retries?: number;
    private readonly checkContainer?: boolean;

    constructor(
        @Inject(UploadOptionsToken)
        private readonly options: UploadModuleOptions<'azure'>
    ) {
        if (options.provider !== 'azure') return;

        configureUploadexLogger(options.debug ?? false);

        const { accountName, accountKey, containerName, endpoint } = options.config;

        if (!accountName || !accountKey || !containerName) {
            throw new UploadexError(
                'CONFIGURATION_ERROR',
                'Azure config is missing accountName, accountKey, or containerName'
            );
        }

        const credentials = new StorageSharedKeyCredential(accountName, accountKey);
        this.client = endpoint
            ? new BlobServiceClient(endpoint, credentials)
            : new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, credentials);

        this.accountName = accountName;
        this.accountKey = accountKey;
        this.containerName = containerName;
        this.endpoint = endpoint;
        this.maxSafeMemorySize = options.maxSafeMemorySize ?? 10 * 1024 * 1024;
        this.timeoutMs = options.uploadTimeoutMs;
        this.retries = options.uploadRetries;
        this.checkContainer = options.config.checkContainer ?? false;
    }

    private async getContainerClient() {
        const containerClient = this.client.getContainerClient(this.containerName);

        if (this.checkContainer) {
            try {
                const exists = await containerClient.exists();

                if (exists) {
                    uploadexLogger.debug(`[Azure] Container "${this.containerName}" exists`, 'AzureProvider');
                } else {
                    uploadexLogger.warn(`[Azure] Container "${this.containerName}" not found, creating...`, 'AzureProvider');
                    await containerClient.create();
                    uploadexLogger.debug(`[Azure] Container created: "${this.containerName}"`, 'AzureProvider');
                }
            } catch (error) {
                uploadexLogger.error(
                    `[Azure] Failed to check or create container "${this.containerName}": ${error.message}`,
                    undefined,
                    'AzureProvider'
                );
                throw new UploadexError('CONFIGURATION_ERROR', `Azure container check or creation failed`, { cause: error });
            }
        }

        return containerClient;
    }

    private getSignedBlobUrl(blobName: string): string {
        const credential = new StorageSharedKeyCredential(this.accountName, this.accountKey);

        const now = new Date();
        const expires = new Date(now.getTime() + 60 * 60 * 1000);

        const sasToken = generateBlobSASQueryParameters({
                containerName: this.containerName,
                blobName,
                permissions: BlobSASPermissions.parse("r"),
                startsOn: now,
                expiresOn: expires,
                protocol: SASProtocol.HttpsAndHttp,
            },
            credential
        ).toString();

        const baseUrl = this.endpoint
            ? this.endpoint.replace('azurite', 'localhost').replace(/\/+$/, '')
            : `https://${this.accountName}.blob.core.windows.net`;

        return `${baseUrl}/${this.containerName}/${blobName}?${sasToken}`;
    }

    public async handleSingleFileUpload(file: Express.Multer.File): Promise<UploadedFileMeta> {
        if (!file) throw new UploadexError('UNKNOWN', 'No file uploaded');

        await validateFile(file, {
            maxSize: this.options.maxFileSize,
            allowedExtensions: this.options.allowedExtensions,
            allowedMimeTypes: this.options.allowedMimeTypes,
        });

        const key = generateSafeFilename(file.originalname, 'azure');
        const container = await this.getContainerClient();
        const blobClient = container.getBlockBlobClient(key);

        const task = async () => {
            const useBuffer = await shouldUseBuffer(file, this.maxSafeMemorySize);

            uploadexLogger.debug(`Uploading "${file.originalname}" using ${useBuffer ? 'buffer' : 'stream'}...`, 'AzureProvider');

            if (useBuffer && file.buffer) {
                await blobClient.uploadData(file.buffer, {
                    blobHTTPHeaders: { blobContentType: file.mimetype },
                });
            } else if (file.path) {
                const stream = fs.createReadStream(file.path);
                await blobClient.uploadStream(stream, undefined, undefined, {
                    blobHTTPHeaders: { blobContentType: file.mimetype },
                });
            } else {
                throw new UploadexError('UNKNOWN', 'No valid file buffer or path');
            }

            uploadexLogger.debug(`Upload successful: ${key}`, 'AzureProvider');

            return {
                fileName: file.originalname,
                storedName: key,
                filePath: this.getSignedBlobUrl(key),
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
            uploadexLogger.error(`Single file upload failed: ${error.message}`, undefined, 'AzureProvider');
            throw error instanceof UploadexError
            ? error
            : new UploadexError('UNKNOWN', `Azure upload failed: ${error.message}`, { cause: error });
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
        const container = await this.getContainerClient();

        const tasks = files.map(async (file) => {
            const key = generateSafeFilename(file.originalname, 'azure');
            const blobClient = container.getBlockBlobClient(key);

            const task = async () => {
                const useBuffer = await shouldUseBuffer(file, this.maxSafeMemorySize);

                uploadexLogger.debug(`Uploading "${file.originalname}" using ${useBuffer ? 'buffer' : 'stream'}...`, 'AzureProvider');

                if (useBuffer && file.buffer) {
                    await blobClient.uploadData(file.buffer, {
                        blobHTTPHeaders: { blobContentType: file.mimetype },
                    });
                } else if (file.path) {
                    const stream = fs.createReadStream(file.path);
                    await blobClient.uploadStream(stream, undefined, undefined, {
                        blobHTTPHeaders: { blobContentType: file.mimetype },
                    });
                } else {
                    throw new UploadexError('UNKNOWN', 'No valid file buffer or path');
                }

                uploadexLogger.debug(`Upload successful: ${key}`, 'AzureProvider');

                return {
                    fileName: file.originalname,
                    storedName: key,
                    filePath: this.getSignedBlobUrl(key),
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

        try {
            await Promise.all(tasks);
            return uploaded;
        } catch (error) {
            await Promise.all(files.filter((f) => f?.path).map((f) => cleanupFile(f.path)));
            uploadexLogger.error(`Multiple file upload failed: ${error.message}`, undefined, 'AzureProvider');
            throw error instanceof UploadexError
                ? error
                : new UploadexError('UNKNOWN', `Multiple Azure upload failed: ${error.message}`, { cause: error });
        }
    }
}
