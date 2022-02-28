import * as middleware from 'lib/middleware';
import { changeImageOrder } from 'lib/service/actions/change_image_order';
import * as apigateway from 'lib/aws/apigateway';
import * as serviceMiddleware from 'lib/service/middleware/common';
import * as changeImageOrderMiddleware from 'lib/service/middleware/change_image_order';


export const handler =
  new middleware.Middleware()
    .with(apigateway.ok)
    .with(changeImageOrder)
    .with(changeImageOrderMiddleware.validateOpts)
    .with(serviceMiddleware.parseJson)
    .with(apigateway.parseBody)
    .onError(async err => apigateway.errorHandler(err))
    .done();
