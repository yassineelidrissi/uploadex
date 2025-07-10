<div align="center">
  <a href="https://uploadex.dev/">
    <img
      src="https://res.cloudinary.com/dojkho3eh/image/upload/v1752075579/readme_logo_ahn31k.png"
      width="80%"
      height="auto"
      alt="Uploadex Logo"
    />
  </a>
</div>

# Uploadex – The Ultimate File Upload Engine for NestJS

Uploadex is a **provider-agnostic**, **production-ready** file upload module for NestJS. Built with a stream-first engine, strict validation, and support for S3, GCS, Azure, Cloudinary, and local uploads — all with one config, one line, and total control

> One config. One interceptor. Total control.

---

## Features

- [x] Stream-first & buffer-aware upload engine:
  - [x] Upload small files fully in-memory
  - [x] Switch to stream upload automatically for large files

- [x] Multiple provider support:
  - [x] Local storage (disk)
  - [x] Amazon S3
  - [x] Azure Blob Storage
  - [x] Google Cloud Storage
  - [x] Cloudinary

- [x] Built-in file validation system:
  - [x] Max file size
  - [x] Allowed MIME types
  - [x] Allowed extensions
  - [x] Allowed number of files

- [x] Automatic safe upload system:
  - [x] Timeout handling
  - [x] Retry logic
  - [x] Cleanup on failure

- [x] Signed URL upload support:
  - [x] Azure SAS
  - [x] GCS signed policies

- [x] Emulator support (for local development):
  - [x] LocalStack (S3)
  - [x] Azurite (Azure)
  - [x] Fake GCS Server

- [x] Filename sanitization:
  - [x] Safe, collision-free filenames with UUIDs, sanitized characters, and extension preservation  
  - [x] Prevents path traversal and ensures cross-platform compatibility

- [x] Multi-file upload made simple:
  - [x] Single file
  - [x] Multiple files

- [x] Fully configurable via `registerAsync()`:
  - [x] Dynamic config with `ConfigModule`
  - [x] Support for any async source (database, .env, etc.)

- [x] Interceptor-ready usage:
  - [x] `@UseInterceptors(UploadexInterceptor)`
  - [x] `@UploadedFile()` / `@UploadedFiles()`

- [x] Framework-ready:
  - [x] NestJS DI support
  - [x] Clean provider abstraction
  - [x] Well-typed and modular

---

## Installation

```bash
npm install uploadex
# or
yarn add uploadex
```

---

## Quick Example (Single File)

```ts
// uploads.controller.ts
@Post('upload')
@UseInterceptors(UploadexInterceptor('file'))
upload(@UploadedFile() file: Express.Multer.File) {
  return this.uploadexService.handleSingleFileUpload(file);
}
```

---

## Configuration (Using ConfigModule)

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UploadsModule } from 'uploadex';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UploadsModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        provider: config.get<'s3' | 'azure' | 'gcs' | 'cloudinary' | 'local'>('UPLOAD_PROVIDER'),

        config: {
          bucket: config.get('S3_BUCKET') ?? '',
          region: config.get('S3_REGION') ?? '',
          accessKeyId: config.get('S3_ACCESS_KEY') ?? '',
          secretAccessKey: config.get('S3_SECRET') ?? '',
          endpoint: config.get('S3_ENDPOINT') ?? '', // For emulator or self-hosted S3
        },

        maxFileSize: parseInt(config.get('MAX_FILE_SIZE') ?? '10485760'),        // 10MB
        maxFiles: parseInt(config.get('MAX_FILES') ?? '5'),                      // Up to 5 files
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],       // Accept only specific MIME types
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],                   // Restrict to safe extensions
        maxSafeMemorySize: parseInt(config.get('MAX_SAFE_MEMORY_SIZE') ?? '5242880'), // Buffer small files (5MB), stream large
        uploadRetries: parseInt(config.get('UPLOAD_RETRIES') ?? '2'),           // Retry twice on failure
        uploadTimeoutMs: parseInt(config.get('UPLOAD_TIMEOUT_MS') ?? '15000'),  // 15s timeout per upload
        debug: true,                                                             // Enable debug logs
      }),
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
})
export class AppModule {}
```

---

## Go Pro With the Full Docs

See the full documentation → [https://www.uploadex.dev](https://www.uploadex.dev/)

Covers:
- Usage with all providers
- Emulator setups (LocalStack, Azurite, etc.)
- Streaming uploads and memory safety
- Configuring retries, timeouts, debug
- Managing env varibales && Error handling in depth
- Best practices for production

---

## Official Examples

Looking for ready-to-use examples?

👉 Check out the full [**Uploadex Examples Repository**](https://github.com/yassineelidrissi/uploadex-examples)
Includes working setups for Local, S3, Azure, GCS, and Cloudinary — all pre-configured.

---

## Author

**Yassine El Idrissi** — [Portfolio](https://www.yaelidrissi.org/)  
Creator of Uploadex, passionate about backend architecture and open source.

---

## Support

If Uploadex saved you time — give it a ⭐ on GitHub  
Tweet about it. Share it with friends. Help us grow the upload revolution.

---

## License

MIT © 2025 Yassine El Idrissi