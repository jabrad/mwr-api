import * as common from './common';
import * as changeImageOrderSchema from 'lib/service/schemas/change_image_order';


export const validateOpts = common.createSchemaValidator(changeImageOrderSchema.validate);
