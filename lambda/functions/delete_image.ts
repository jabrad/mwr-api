import * as middleware from 'lib/middleware';
import { deleteImage } from 'lib/service/actions/delete_image';
import * as apigateway from 'lib/aws/apigateway';
import * as serviceMiddleware from 'lib/service/middleware/common';
import * as deleteImageMiddleware from 'lib/service/middleware/delete_image';


export const handler =
  new middleware.Middleware()
    .with(apigateway.ok)
    .with(deleteImage)
    .with(deleteImageMiddleware.validateOpts)
    .with(serviceMiddleware.parseQuery)
    .with(apigateway.createPayloadPropertyGetter('rawQueryString'))
    .onError(async err => apigateway.errorHandler(err))
    .done();
