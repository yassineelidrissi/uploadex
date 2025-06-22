import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { UploadexNestException } from './uploadex-nest-exceptions';

@Catch()
export class UploadexExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        const transformed = UploadexNestException(exception);
        const status = transformed instanceof HttpException ? transformed.getStatus() : 500;
        const body = transformed instanceof HttpException ? transformed.getResponse() : { message: 'Internal server error' };

        response.status(status).json(body);
    }
}