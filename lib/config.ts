/* eslint-disable @typescript-eslint/no-non-null-assertion */

import type { CredentialsOptions } from 'aws-sdk/lib/credentials';
import Ajv, { JSONSchemaType } from 'ajv';


export interface BasicAWSConfig {
  region: string;
  credentials: CredentialsOptions;
}

export interface Config {
  // Externals
  bucketName: string;
  tableName: string;
  ddbQueueUrl: string;
  basicAWSConfig: BasicAWSConfig;

  // Development environment config
  devBucketRegion?: string;
  devDdbEndpoint?: string;

  // Params
  uploadsStorePrefix: string;
  rawImgStorePrefix: string;
  imgStorePrefix: string;
  postImageMaxTags: number;
  postImageMaxAspects: number;
  getImagesPageSize: number;
  getImagesByTagPageSize: number;
  getUploadsPageSize: number;
  uploadImageExpires: number;
}

const configSchema: JSONSchemaType<Config> = {
  type      : 'object',
  properties: {
    bucketName    : { type: 'string' },
    tableName     : { type: 'string' },
    ddbQueueUrl   : { type: 'string' },
    basicAWSConfig: {
      type      : 'object',
      properties: {
        region     : { type: 'string' },
        credentials: {
          type      : 'object',
          properties: {
            accessKeyId    : { type: 'string' },
            secretAccessKey: { type: 'string' },
            sessionToken   : { type: 'string', nullable: true },
          },
          required            : ['accessKeyId', 'secretAccessKey'],
          additionalProperties: false,
        },
      },
      required            : ['region', 'credentials'],
      additionalProperties: false,
    },

    devBucketRegion: { type: 'string', nullable: true },
    devDdbEndpoint : { type: 'string', nullable: true },

    uploadsStorePrefix    : { type: 'string' },
    rawImgStorePrefix     : { type: 'string' },
    imgStorePrefix        : { type: 'string' },
    postImageMaxTags      : { type: 'integer', minimum: 1 },
    postImageMaxAspects   : { type: 'integer', minimum: 1 },
    getImagesPageSize     : { type: 'integer', minimum: 1 },
    getImagesByTagPageSize: { type: 'integer', minimum: 1 },
    getUploadsPageSize    : { type: 'integer', minimum: 1 },
    uploadImageExpires    : { type: 'integer', minimum: 1 },
  },
  required: [
    'bucketName',
    'ddbQueueUrl',
    'tableName',
    'basicAWSConfig',
    'uploadsStorePrefix',
    'rawImgStorePrefix',
    'imgStorePrefix',
    'postImageMaxTags',
    'postImageMaxAspects',
    'getImagesPageSize',
    'getImagesByTagPageSize',
    'getUploadsPageSize',
    'uploadImageExpires',
  ],
  additionalProperties: false,
};

const ajv = new Ajv({ coerceTypes: true });
const validate = ajv.compile(configSchema);

const rawConfig = {
  bucketName    : process.env['BUCKET_NAME'],
  tableName     : process.env['TABLE_NAME'],
  ddbQueueUrl   : process.env['DDB_QUEUE_URL'],
  basicAWSConfig: {
    region     : process.env['AWS_REGION'],
    credentials: {
      accessKeyId    : process.env['AWS_ACCESS_KEY_ID'],
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'],
      sessionToken   : process.env['AWS_SESSION_TOKEN'],
    },
  },
  devBucketRegion       : process.env['DEV_BUCKET_REGION'],
  devDdbEndpoint        : process.env['DEV_DDB_ENDPOINT'],
  uploadsStorePrefix    : process.env['UPLOADS_STORE_PREFIX'],
  rawImgStorePrefix     : process.env['RAW_IMG_STORE_PREFIX'],
  imgStorePrefix        : process.env['IMG_STORE_PREFIX'],
  postImageMaxTags      : process.env['POST_IMAGE_MAX_TAGS'],
  postImageMaxAspects   : process.env['POST_IMAGE_MAX_ASPECTS'],
  getImagesPageSize     : process.env['GET_IMAGES_PAGE_SIZE'],
  getImagesByTagPageSize: process.env['GET_IMAGES_BY_TAG_PAGE_SIZE'],
  getUploadsPageSize    : process.env['GET_UPLOADS_PAGE_SIZE'],
  uploadImageExpires    : process.env['UPLOAD_IMAGE_EXPIRES'],
};

let config: Config;

if (validate(rawConfig)) {
  config = rawConfig;
}
else {
  console.error(ajv.errorsText(validate.errors));

  process.exit(1);
}

export default config;
