export type UploadexErrorCode =
    | 'INVALID_MIME_TYPE'
    | 'INVALID_EXTENSION'
    | 'FILE_TOO_LARGE'
    | 'MAX_FILES_EXCEEDED'
    | 'CONFIGURATION_ERROR'
    | 'PROVIDER_NOT_IMPLEMENTED'
    | 'UNKNOWN'
    | 'UPLOAD_FAILED'
    | 'TIMEOUT';

export class UploadexError extends Error {
    public readonly code: UploadexErrorCode;
    public readonly details?: any;

    constructor(code: UploadexErrorCode, message: string, details?: any) {
        super(message);
        this.name = 'UploadexError';
        this.code = code;
        this.details = details;
    }
}
