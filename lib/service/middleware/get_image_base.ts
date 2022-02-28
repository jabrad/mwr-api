import * as serviceErrors from 'lib/service/errors';
import { GetImageBaseOpts } from 'lib/service/actions/get_image_base';
import * as common from './common';


export const validateOpts = (query: common.QueryParams): GetImageBaseOpts => {
  if (!query.id)
    throw new serviceErrors.UnspecifiedId();

  common.validateImageId(query.id);

  return { imageId: query.id };
};
