import * as common from './common';
import * as postImageSchema from 'lib/service/schemas/post_image';


export const validateOpts = common.createSchemaValidator(postImageSchema.validate);
