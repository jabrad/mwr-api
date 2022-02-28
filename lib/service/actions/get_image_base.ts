import * as tableOne from 'lib/external/tables/table_one';
import config from 'lib/config';
import * as serviceErrors from 'lib/service/errors';
import * as imageResource from 'lib/service//resources/image';


export interface GetImageBaseOpts {
  imageId: string;
}


export const getImageBase = async (opts: GetImageBaseOpts)
: Promise<imageResource.BaseImage> => {

  const tableOneClient = new tableOne.TableOne(config.tableName, config.basicAWSConfig);

  try {
    const result = await tableOneClient.getBase(opts.imageId);

    if (result)
      return result;
    else
      throw new serviceErrors.NoSuchImage(opts.imageId);
  }
  catch (err) {
    console.error(err);

    const errMessage = 'Failed to retrieve an image base from the database';

    if (tableOne.isExternalFailure(err))
      throw new serviceErrors.ExternalServerError(errMessage);

    throw new serviceErrors.InternalError(errMessage);
  }
};
