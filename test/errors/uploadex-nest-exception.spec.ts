import { UploadexNestException } from '../../lib/errors/uploadex-nest-exceptions';
import { UploadexError } from '../../lib/errors/uploadex-error';
import {
  BadRequestException,
  InternalServerErrorException,
  NotImplementedException,
} from '@nestjs/common';

describe('UploadexNestException', () => {
    it('should return BadRequestException for INVALID_MIME_TYPE', () => {
        const error = new UploadexError('INVALID_MIME_TYPE', 'Invalid MIME');
        const result = UploadexNestException(error);
        expect(result).toBeInstanceOf(BadRequestException);
    });

    it('should return BadRequestException for FILE_TOO_LARGE', () => {
        const error = new UploadexError('FILE_TOO_LARGE', 'Too large');
        const result = UploadexNestException(error);
        expect(result).toBeInstanceOf(BadRequestException);
    });

    it('should return NotImplementedException for PROVIDER_NOT_IMPLEMENTED', () => {
        const error = new UploadexError('PROVIDER_NOT_IMPLEMENTED', 'Provider missing');
        const result = UploadexNestException(error);
        expect(result).toBeInstanceOf(NotImplementedException);
    });

    it('should return InternalServerErrorException for CONFIGURATION_ERROR', () => {
        const error = new UploadexError('CONFIGURATION_ERROR', 'Bad config');
        const result = UploadexNestException(error);
        expect(result).toBeInstanceOf(InternalServerErrorException);
    });

    it('should fallback to InternalServerErrorException for unknown code', () => {
        const error = new UploadexError('SOMETHING_NEW' as any, 'New error');
        const result = UploadexNestException(error);
        expect(result).toBeInstanceOf(InternalServerErrorException);
    });

    it('should return original error if not an UploadexError', () => {
        const error = new Error('Some generic error');
        const result = UploadexNestException(error);
        expect(result).toBe(error);
    });
});
