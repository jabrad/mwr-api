import * as middleware from 'lib/middleware';
import { getImages } from 'lib/service/actions/get_images';
import * as apigateway from 'lib/aws/apigateway';
import * as serviceMiddleware from 'lib/service/middleware/common';
import * as getImagesMiddleware from 'lib/service/middleware/get_images';


export const handler =
  new middleware.Middleware()
    .with(apigateway.okJson)
    .with(getImages)
    .with(getImagesMiddleware.validateOpts)
    .with(serviceMiddleware.parseQuery)
    .with(apigateway.createPayloadPropertyGetter('rawQueryString'))
    .onError(async err => apigateway.errorHandler(err))
    .done();
