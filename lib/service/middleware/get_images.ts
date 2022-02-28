import { GetImagesOpts } from 'lib/service/actions/get_images';
import * as imageResource from 'lib/service/resources/image';
import * as serviceErrors from 'lib/service/errors';
import * as common from './common';


export const validateOpts = (query: common.QueryParams): GetImagesOpts => {
  if (query.tag)
    common.validateTag(query.tag);

  let startImageId: string;
  let startOrder: string;

  if (query.start) {
    [startImageId, startOrder] = query.start.split(';');

    if (!imageResource.testId(startImageId) || !Number.isInteger(Number(startOrder)))
      throw new serviceErrors.InvalidOpts('Invalid start token');
  }

  return {
    tag  : query.tag,
    start: query.start,
  };
};
