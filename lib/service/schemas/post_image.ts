import Ajv, { JSONSchemaType } from 'ajv';
import config from 'lib/config';
import { PostImageOpts } from '../actions/post_image';
import { idPattern } from '../resources/image';
import { tagPattern } from '../resources/tags';


export const schema: JSONSchemaType<PostImageOpts> = {
  type      : 'object',
  properties: {
    baseImageId: {
      type   : 'string',
      pattern: idPattern.source,
    },
    fromUpload: {
      type   : 'boolean',
      default: true,
    },
    order: {
      type: 'integer',
    },
    tags: {
      type : 'array',
      items: {
        type   : 'string',
        pattern: tagPattern.source,
      },
      minItems   : 1,
      maxItems   : config.postImageMaxTags,
      uniqueItems: true,
    },
    resize: {
      type : 'array',
      items: {
        type      : 'object',
        properties: {
          width : { type: 'integer', minimum: 0, nullable: true },
          height: { type: 'integer', minimum: 0, nullable: true },
        },
        oneOf: [
          { required: ['width'] },
          { required: ['height'] },
        ],
        required            : [],
        additionalProperties: false,
      },
      minItems: 1,
      maxItems: config.postImageMaxAspects,
      nullable: true,
    },
    crop: {
      type      : 'object',
      properties: {
        angle : { type: 'number' },
        top   : { type: 'integer', minimum: 0 },
        left  : { type: 'integer', minimum: 0 },
        width : { type: 'integer', minimum: 0 },
        height: { type: 'integer', minimum: 0 },
      },
      required            : ['top', 'left', 'width', 'height'],
      nullable            : true,
      additionalProperties: false,
    },
    thumbnail: {
      type      : 'object',
      properties: {
        width : { type: 'integer', minimum: 0, nullable: true },
        height: { type: 'integer', minimum: 0, nullable: true },
        crop  : {
          type      : 'object',
          properties: {
            top   : { type: 'integer', minimum: 0 },
            left  : { type: 'integer', minimum: 0 },
            width : { type: 'integer', minimum: 0 },
            height: { type: 'integer', minimum: 0 },
          },
          required            : ['top', 'left', 'width', 'height'],
          nullable            : true,
          additionalProperties: false,
        },
      },
      oneOf: [
        { required: ['width'] },
        { required: ['height'] },
      ],
      required            : [],
      additionalProperties: false,
    },
  },
  required            : ['baseImageId', 'order', 'tags', 'thumbnail'],
  additionalProperties: false,
};

const ajv = new Ajv({
  useDefaults: true,
});

export const validate = ajv.compile(schema);
