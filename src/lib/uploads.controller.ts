import { Controller, Post, UploadedFile, UploadedFiles, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './providers/uploads.service';
  
@Controller('uploads')
export class UploadsController {
    constructor(private readonly uploadsService: UploadsService) {}

    @Post('single')
    @UseInterceptors(FileInterceptor('file'))
    async uploadSingleFile(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('File is missing');
        return this.uploadsService.handleSingleFileUpload(file);
    }

    @Post('multiple')
    @UseInterceptors(FilesInterceptor('files', 10))
    async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files?.length) throw new BadRequestException('No files uploaded');
        return this.uploadsService.handleMultipleFileUpload(files);
    }
}