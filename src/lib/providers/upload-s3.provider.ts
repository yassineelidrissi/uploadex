import { Inject, Injectable } from '@nestjs/common';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';
import { UploadOptionsToken } from '../strategies/upload-options.token';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand, BucketLocationConstraint } from '@aws-sdk/client-s3';

@Injectable()
export class UploadS3Provider implements UploadProvider {
    private readonly s3: S3Client;
    private readonly bucket: string;
    private readonly region: string;

    constructor(
        @Inject(UploadOptionsToken)
        private readonly options: UploadModuleOptions<'s3'>,
    ) {
        const config = this.options.config;
        this.bucket = config.bucket;
        this.region = config.region;

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

        if (config.endpoint) {
            this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }))
            .catch(() => {
                return this.s3.send(new CreateBucketCommand({
                        Bucket: this.bucket,
                        ...(this.region !== 'us-east-1' && {
                        CreateBucketConfiguration: {
                            LocationConstraint: this.region as BucketLocationConstraint,
                        },
                    }),
                }));
            });
        }

    }

    async handleSingleFileUpload(file: Express.Multer.File): Promise<any> {
        const key = `${uuidv4()}-${file.originalname}`;

        await this.s3.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
            }),
        );

        const url = this.options.config.endpoint
            ? this.options.config.endpoint.replace('localstack', 'localhost') + `/${this.bucket}/${key}`
            : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

        return {
            fileName: file.originalname,
            filePath: url,
            mimeType: file.mimetype,
            size: file.size,
        };
    }

    async handleMultipleFileUpload(files: Express.Multer.File[]): Promise<any[]> {
        return Promise.all(files.map(file => this.handleSingleFileUpload(file)));
    }
}
