import * as serviceErrors from 'lib/service/errors';
import { DeleteImageOpts } from 'lib/service/actions/delete_image';
import * as common from './common';


export const validateOpts = (query: common.QueryParams): DeleteImageOpts => {
  if (!query.id)
    throw new serviceErrors.UnspecifiedId();

  common.validateImageId(query.id);

  return { imageId: query.id };
};
