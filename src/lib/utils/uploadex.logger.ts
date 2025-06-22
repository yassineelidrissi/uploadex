import { Logger } from '@nestjs/common';

let debugEnabled = false;

export function configureUploadexLogger(enabled: boolean) {
    debugEnabled = enabled;
}

export const uploadexLogger = {
    log(message: string, context = 'Uploadex') {
        if (debugEnabled) Logger.log(message, context);
    },
    error(message: string, trace?: string, context = 'Uploadex') {
        if (debugEnabled) Logger.error(message, trace, context);
    },
    warn(message: string, context = 'Uploadex') {
        if (debugEnabled) Logger.warn(message, context);
    },
    debug(message: string, context = 'Uploadex') {
        if (debugEnabled) Logger.debug(message, context);
    },
    verbose(message: string, context = 'Uploadex') {
        if (debugEnabled) Logger.verbose(message, context);
    },
};
