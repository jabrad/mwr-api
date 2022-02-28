import Ajv, { JSONSchemaType } from 'ajv';
import { ChangeImageOrderOpts } from '../actions/change_image_order';
import { idPattern } from '../resources/image';


export const schema: JSONSchemaType<ChangeImageOrderOpts> = {
  type      : 'object',
  properties: {
    imageId: {
      type   : 'string',
      pattern: idPattern.source,
    },
    order: {
      type: 'number',
    },
  },
  required            : ['imageId', 'order'],
  additionalProperties: false,
};

const ajv = new Ajv();

export const validate = ajv.compile(schema);
