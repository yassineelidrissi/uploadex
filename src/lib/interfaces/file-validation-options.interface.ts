export interface FileValidationOptions {
    maxSize?: number;
    maxFiles?: number;
    allowedExtensions?: string[];
    allowedMimeTypes?: string[];
}