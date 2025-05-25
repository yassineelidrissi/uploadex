import { multerOptionsFactory } from '../providers/multer-options.factory';
import { UploadModuleOptions } from '../interfaces/upload-module-options.interface';

export async function multerDynamicOptions(config: UploadModuleOptions) {

    if(config.provider !== 'local') return { storage: undefined };

    return multerOptionsFactory(config);

}