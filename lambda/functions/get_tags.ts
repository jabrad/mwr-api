import * as middleware from 'lib/middleware';
import { getTags } from 'lib/service/actions/get_tags';
import * as apigateway from 'lib/aws/apigateway';


export const handler =
  new middleware.Middleware()
    .with(apigateway.okJson)
    .with(getTags)
    .onError(async err => apigateway.errorHandler(err))
    .done();
