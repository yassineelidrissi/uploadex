import { BadRequestException, InternalServerErrorException, NotImplementedException } from '@nestjs/common';
import { UploadexError } from '../errors/uploadex-error';


export function UploadexNestException(error: unknown) {
    if (!(error instanceof UploadexError)) return error;

    switch (error.code) {
        case 'INVALID_MIME_TYPE':
        case 'INVALID_EXTENSION':
        case 'FILE_TOO_LARGE':
        case 'MAX_FILES_EXCEEDED':
        case 'UNKNOWN':
            return new BadRequestException({ message: error.message, code: error.code, details: error.details });
        case 'PROVIDER_NOT_IMPLEMENTED':
            return new NotImplementedException({ message: error.message, code: error.code });
        case 'CONFIGURATION_ERROR':
            return new InternalServerErrorException({ message: error.message, code: error.code });
        default:
            return new InternalServerErrorException({ message: 'Unexpected upload error', code: 'UNKNOWN' });
    }
}