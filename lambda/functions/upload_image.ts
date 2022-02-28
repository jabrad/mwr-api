import * as middleware from 'lib/middleware';
import { generateImagePost } from 'lib/service/actions/upload_image';
import * as apigateway from 'lib/aws/apigateway';


export const handler =
  new middleware.Middleware()
    .with(apigateway.okJson)
    .with(async () => generateImagePost())
    .onError(async err => apigateway.errorHandler(err))
    .done();
