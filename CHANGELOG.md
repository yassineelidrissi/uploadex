# 📦 Changelog

All notable changes to Uploadex will be documented in this file.

---

## [1.0.0] - 2025-07-09
### ✨ Initial Release
- Uploadex v1 launched with core upload engine for NestJS
- **Hybrid Uploads**: Buffer-based for small files, stream-based for large files
- **Multi-Provider Support**: Local, S3, Azure Blob, Google Cloud Storage, Cloudinary
- **Strict Validation System**: File size, MIME type, extension, count
- **Safe Filename Handling**: Path sanitization, UUID naming, extension preservation
- **Config-First Architecture**: Register once, use anywhere
- **Smart Memory Management**: Auto-switches between in-memory and disk streaming
- **Emulator Support**: Seamless development with LocalStack, Azurite, Fake GCS Server
- **Signed URL Generation**: For S3, Azure, and GCS (via SAS or pre-signed)
- **Auto Bucket/Container Creation**: Optional via `checkBucket` / `checkContainer`
- **Timeout & Retry Logic**: Robust error handling with optional retry system
