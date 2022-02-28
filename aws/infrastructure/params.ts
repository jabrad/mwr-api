import * as dotenv from 'dotenv';
import Ajv, { JSONSchemaType, ValidateFunction } from 'ajv';


export interface ProdEnvParams {
  environment: 'production';
  domain: string;
  hostedZoneId: string;
  apiHostname: string;
  authHostname: string;
  cdnHostname: string;
  oAuth2CallbackURL: string[];
  oAuth2LogoutURL: string[];
  corsAllowedOrigins: string[];
  rcu: number;
  wcu: number;
  usEast1AcmCertificateArn: string;
  regionalAcmCertificateArn: string;

  // Lambda env variables
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


const defaultUploadsStorePrefix = 'uploads/';
const defaultRawImgStorePrefix = 'raw/';
const defaultImgStorePrefix = 'images/';

const domainPattern = /^((?!-)[A-Za-z0-9-]{0,62}[A-Za-z0-9])\.((?!-)[A-Za-z0-9-]{1,62}[A-Za-z0-9])$/;
const hostnamePattern = /^(?!-)[A-Za-z0-9-]{0,62}[A-Za-z0-9]$/;
const httpsUrlPattern = /^https:\/\/(((?!-)[A-Za-z0-9-]{0,62}[A-Za-z0-9])\.)+((?!-)[A-Za-z0-9-]{1,62}[A-Za-z0-9])[^.]*$/;
const acmCertPattern = /^arn:aws:acm:[a-z][a-z0-9-]*:[0-9]+:certificate\/[a-z0-9-]+$/;

const prodEnvParamsSchema: JSONSchemaType<ProdEnvParams> = {
  type      : 'object',
  properties: {
    environment: {
      type : 'string',
      const: 'production',
    },
    domain: {
      type   : 'string',
      pattern: domainPattern.source,
    },
    hostedZoneId: {
      type: 'string',
    },
    apiHostname: {
      type   : 'string',
      pattern: hostnamePattern.source,
      default: 'api',
    },
    authHostname: {
      type   : 'string',
      pattern: hostnamePattern.source,
      default: 'auth',
    },
    cdnHostname: {
      type   : 'string',
      pattern: hostnamePattern.source,
      default: 'cdn',
    },
    oAuth2CallbackURL: {
      type : 'array',
      items: {
        type : 'string',
        oneOf: [
          { pattern: httpsUrlPattern.source },
          { pattern: '^http://localhost' },
        ],
        minLength: 1,
      },
    },
    oAuth2LogoutURL: {
      type : 'array',
      items: {
        type : 'string',
        oneOf: [
          { pattern: httpsUrlPattern.source },
          { pattern: '^http://localhost' },
        ],
        minLength: 1,
      },
    },
    corsAllowedOrigins: {
      type : 'array',
      items: {
        type : 'string',
        oneOf: [
          { pattern: httpsUrlPattern.source },
          { pattern: '^http://localhost' },
        ],
        minLength: 1,
      },
    },
    rcu: {
      type   : 'number',
      minimum: 2,
      default: 2,
    },
    wcu: {
      type   : 'number',
      minimum: 2,
      default: 2,
    },
    usEast1AcmCertificateArn: {
      type   : 'string',
      pattern: acmCertPattern.source,
    },
    regionalAcmCertificateArn: {
      type   : 'string',
      pattern: acmCertPattern.source,
    },
    uploadsStorePrefix: {
      type   : 'string',
      default: defaultUploadsStorePrefix,
    },
    rawImgStorePrefix: {
      type   : 'string',
      default: defaultRawImgStorePrefix,
    },
    imgStorePrefix: {
      type   : 'string',
      default: defaultImgStorePrefix,
    },
    postImageMaxTags      : { type: 'integer', minimum: 1 },
    postImageMaxAspects   : { type: 'integer', minimum: 1 },
    getImagesPageSize     : { type: 'integer', minimum: 1 },
    getImagesByTagPageSize: { type: 'integer', minimum: 1 },
    getUploadsPageSize    : { type: 'integer', minimum: 1 },
    uploadImageExpires    : { type: 'integer', minimum: 1 },
  },
  required: [
    'environment',
    'domain',
    'hostedZoneId',
    'apiHostname',
    'authHostname',
    'cdnHostname',
    'oAuth2CallbackURL',
    'oAuth2LogoutURL',
    'corsAllowedOrigins',
    'rcu',
    'wcu',
    'usEast1AcmCertificateArn',
    'regionalAcmCertificateArn',
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

dotenv.config();

const ajv = new Ajv({ coerceTypes: true, useDefaults: 'empty' });
let validate: ValidateFunction<ProdEnvParams>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rawParams: any;
let params: ProdEnvParams;

const oAuth2CallbackUrl = JSON.parse(process.env.OAUTH2_CALLBACK_URL || '');
const oAuth2LogoutURL = JSON.parse(
  process.env.OAUTH2_LOGOUT_URL || process.env.OAUTH2_CALLBACK_URL || '');
const corsAllowedOrigins = JSON.parse(process.env.CORS_ALLOWED_ORIGINS || '');

if (process.env.NODE_ENV === 'production') {
  rawParams = {
    environment              : 'production',
    domain                   : process.env.DOMAIN,
    hostedZoneId             : process.env.HOSTED_ZONE_ID,
    apiHostname              : process.env.API_HOSTNAME,
    authHostname             : process.env.AUTH_HOSTNAME,
    cdnHostname              : process.env.CDN_HOSTNAME,
    oAuth2CallbackURL        : oAuth2CallbackUrl,
    oAuth2LogoutURL          : oAuth2LogoutURL,
    corsAllowedOrigins       : corsAllowedOrigins,
    rcu                      : process.env.RCU,
    wcu                      : process.env.WCU,
    usEast1AcmCertificateArn : process.env.US_EAST1_ACM_CERTIFICATE_ARN,
    regionalAcmCertificateArn: process.env.REGIONAL_ACM_CERTIFICATE_ARN,
    uploadsStorePrefix       : process.env.UPLOADS_STORE_PREFIX,
    rawImgStorePrefix        : process.env.RAW_IMG_STORE_PREFIX,
    imgStorePrefix           : process.env.IMG_STORE_PREFIX,
    postImageMaxTags         : process.env.POST_IMAGE_MAX_TAGS,
    postImageMaxAspects      : process.env.POST_IMAGE_MAX_ASPECTS,
    getImagesPageSize        : process.env.GET_IMAGES_PAGE_SIZE,
    getImagesByTagPageSize   : process.env.GET_IMAGES_BY_TAG_PAGE_SIZE,
    getUploadsPageSize       : process.env.GET_UPLOADS_PAGE_SIZE,
    uploadImageExpires       : process.env.UPLOAD_IMAGE_EXPIRES,
  };

  validate = ajv.compile(prodEnvParamsSchema);
}
else {
  throw new Error(`Development stack is currently unsupported`);
}

if (validate(rawParams)) {
  params = rawParams;
}
else {
  console.error(ajv.errorsText(validate.errors));

  process.exit(1);
}

export default params;
