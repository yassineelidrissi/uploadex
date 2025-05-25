import { Inject, Injectable } from '@nestjs/common';
import { UploadStrategyToken } from '../strategies/upload-strategy.token';
import { UploadProvider } from '../interfaces/upload-provider.interface';

@Injectable()
export class UploadsService {

    constructor(
        @Inject(UploadStrategyToken)
        private readonly uploadStrategy: UploadProvider
    ) {}

    
    public async handleSingleFileUpload(file: Express.Multer.File) {
        return await this.uploadStrategy.handleSingleFileUpload(file);
    }

    public async handleMultipleFileUpload(files: Express.Multer.File[]) {
        return await this.uploadStrategy.handleMultipleFileUpload(files);
    }

}