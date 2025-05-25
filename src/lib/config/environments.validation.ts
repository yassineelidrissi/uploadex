import * as Joi from 'joi';

export default Joi.object({
    NODE_ENV: Joi.string()
    .valid('development', 'test', 'production', 'staging')
    .default('development'),
    MAX_FILE_SIZE: Joi.number().required(),
    MAX_FILES: Joi.string().required()
});