import * as middleware from 'lib/middleware';
import { getUploads } from 'lib/service/actions/get_uploads';
import * as apigateway from 'lib/aws/apigateway';
import * as serviceMiddleware from 'lib/service/middleware/common';
import * as getUploadsMiddleware from 'lib/service/middleware/get_uploads';


export const handler =
  new middleware.Middleware()
    .with(apigateway.okJson)
    .with(getUploads)
    .with(getUploadsMiddleware.validateOpts)
    .with(serviceMiddleware.parseQuery)
    .with(apigateway.createPayloadPropertyGetter('rawQueryString'))
    .onError(async err => apigateway.errorHandler(err))
    .done();
