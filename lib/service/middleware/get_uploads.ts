import { GetUploadsOpts } from 'lib/service/actions/get_uploads';
import * as common from './common';


export const validateOpts = (query: common.QueryParams): GetUploadsOpts => ({
  start: query.start, // TODO: validate
});
