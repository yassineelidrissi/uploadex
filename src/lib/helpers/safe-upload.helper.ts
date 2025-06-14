import { UploadexError } from '../errors/uploadex-error';

interface SafeUploadOptions {
    timeoutMs?: number;
    retries?: number;
    onCleanup?: () => Promise<void>;
}

export async function safeUpload<T>(
    task: () => Promise<T>,
    options: SafeUploadOptions = {},
): Promise<T> {
    const { timeoutMs, retries, onCleanup } = options;
    const maxAttempts = (retries ?? 0) + 1;
    let attempts = 0;
    let lastError: any;

    while (attempts < maxAttempts) {
        attempts++;

        try {
            const result = timeoutMs
            ? await withTimeout(task(), timeoutMs)
            : await task();

            return result;
        } catch (error) {
            lastError = error;

            if (onCleanup) await onCleanup();

            if (attempts >= maxAttempts) break;

            await delay(500 * attempts);
        }
    }

    throw new UploadexError(
        'UPLOAD_FAILED',
        `Upload failed after ${maxAttempts} attempt(s): ${lastError?.message || 'Unknown error'}`,
        { cause: lastError }
    );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(
                new UploadexError(
                'TIMEOUT',
                `Upload timed out after ${ms}ms`
            ));
    }, ms);

    promise
        .then((res) => {
            clearTimeout(timer);
            resolve(res);
        })
        .catch((err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
