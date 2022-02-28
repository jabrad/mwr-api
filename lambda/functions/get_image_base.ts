import * as middleware from 'lib/middleware';
import { getImageBase } from 'lib/service/actions/get_image_base';
import * as apigateway from 'lib/aws/apigateway';
import * as serviceMiddleware from 'lib/service/middleware/common';
import * as getImageBaseMiddleware from 'lib/service/middleware/get_image_base';


export const handler =
  new middleware.Middleware()
    .with(apigateway.okJson)
    .with(getImageBase)
    .with(getImageBaseMiddleware.validateOpts)
    .with(serviceMiddleware.parseQuery)
    .with(apigateway.createPayloadPropertyGetter('rawQueryString'))
    .onError(async err => apigateway.errorHandler(err))
    .done();
