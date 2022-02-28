import * as middleware from 'lib/middleware';
import { postImage } from 'lib/service/actions/post_image';
import * as apigateway from 'lib/aws/apigateway';
import * as serviceMiddleware from 'lib/service/middleware/common';
import * as postImageMiddleware from 'lib/service/middleware/post_image';


export const handler =
  new middleware.Middleware()
    .with(apigateway.okJson)
    .with(postImage)
    .with(postImageMiddleware.validateOpts)
    .with(serviceMiddleware.parseJson)
    .with(apigateway.parseBody)
    .onError(async err => apigateway.errorHandler(err))
    .done();
