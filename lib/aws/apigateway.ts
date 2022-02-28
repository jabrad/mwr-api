import * as serviceErrors from 'lib/service/errors';
import Mime from 'lib/mime';


export interface ApiGatewayV2PayloadV2 {
  version: '2.0';
  routeKey: string;
  rawPath: string;
  rawQueryString: string;
  cookies?: string[];
  headers: {[header: string]: string | undefined};
  // Multivalue params are concatenated using a comma (,). Commas inside params are not
  // escaped!!! If you expect multivalue params, parse them using the rawQueryString prop.
  queryStringParameters?: {[parameter: string]: string | undefined};
  requestContext: {
    accountId: string;
    apiId: string;
    authorizer?: {
      jwt: {
        claims: {[claim: string]: string | undefined};
        scopes: string[] | null;
      };
    };
    domainName: string;
    domainPrefix: string;
    http: {
      method: string;
      path: string;
      protocol: string;
      sourceIp: string;
      userAgent: string;
    };
    requestId: string;
    routeKey: string;
    stage: string;
    time: string;
    timeEpoch: number;
  };
  body?: string;
  pathParameters?: {[parameter: string]: string | undefined};
  isBase64Encoded: boolean;
  stageVariables?: {[variable: string]: string | undefined};
}


export interface ApiGatewayV2ResponseV2 {
  statusCode: number;
  headers?: {[key: string]: string};
  body?: string;
  isBase64Encoded?: boolean;
  cookies?: string[];
}


export const errorResponse = (err: serviceErrors.ServiceError)
: ApiGatewayV2ResponseV2 => ({
  statusCode: err.statusCode,
  body      : JSON.stringify({
    code   : err.code,
    message: err.statusCode < 500 ? err.message : undefined,
  }),
  headers: {
    'Content-Type': Mime.json,
  },
});


export const ok = (): ApiGatewayV2ResponseV2 => ({
  statusCode: 200,
});


export const okJson = (body?: unknown): ApiGatewayV2ResponseV2 => ({
  statusCode: 200,
  body      : JSON.stringify(body),
  headers   : {
    'Content-Type': Mime.json,
  },
});


export const parseBody = (event: ApiGatewayV2PayloadV2): string => {
  if (!event.body)
    throw new serviceErrors.InvalidOpts('Empty body');

  const decodedBody = event.isBase64Encoded ?
    Buffer.from(event.body, 'base64').toString() : event.body;

  return decodedBody;
};


export const errorHandler = (err: unknown): ApiGatewayV2ResponseV2 => {
  console.error(err);

  if (err instanceof serviceErrors.ServiceError)
    return errorResponse(err);
  else
    return errorResponse(new serviceErrors.InternalError());
};


export const createPayloadPropertyGetter =
  <T extends keyof ApiGatewayV2PayloadV2>(property: T)
  :(event: ApiGatewayV2PayloadV2) => ApiGatewayV2PayloadV2[T] =>
    event => event[property];
