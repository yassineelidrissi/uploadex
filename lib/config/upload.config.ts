import { registerAs } from "@nestjs/config"

export default registerAs('uploadConfig', () => ({
    maxFileSize: process.env.MAX_FILE_SIZE,
    maxFiles: process.env.MAX_FILES,
    cloudinaryName: process.env.CLOUDINARY_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinarySecretKey: process.env.CLOUDINARY_SECRET_KEY
}));