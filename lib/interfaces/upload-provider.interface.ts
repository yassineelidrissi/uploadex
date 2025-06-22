export interface UploadProvider {
    handleSingleFileUpload(file: Express.Multer.File): Promise<any>;
    handleMultipleFileUpload(files: Express.Multer.File[]): Promise<any>;
}