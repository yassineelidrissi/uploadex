import { generateSafeFilename } from '../../lib/helpers/filename.helper';

describe('generateSafeFilename', () => {
    it('should return a filename with correct prefix and uuid', () => {
        const result = generateSafeFilename('My File.jpg', 'custom');
        expect(result).toMatch(/^custom-[\w-]{36}-my-file\.jpg$/);
    });

    it('should sanitize special characters and spaces', () => {
        const result = generateSafeFilename('hello @$% 2024!.png');
        expect(result).toMatch(/^upload-[\w-]{36}-hello-2024\.png$/);
    });

    it('should truncate sanitized name to max 100 characters (excluding prefix/uuid/ext)', () => {
        const longName = 'x'.repeat(200) + '.pdf';
        const result = generateSafeFilename(longName);

        const match = result.match(/^upload-[\w-]{36}-(.*)\.pdf$/);
        expect(match).not.toBeNull();

        const sanitized = match?.[1];
        expect(sanitized?.length).toBeLessThanOrEqual(100);
    });

    it('should default to "file" when originalName is missing or invalid', () => {
        expect(generateSafeFilename('')).toBe('file');
        expect(generateSafeFilename(null as any)).toBe('file');
        expect(generateSafeFilename(undefined as any)).toBe('file');
    });

    it('should lowercase and preserve correct extension', () => {
        const result = generateSafeFilename('Photo.JPG');
        expect(result).toMatch(/\.jpg$/);
    });
});
