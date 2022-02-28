import * as tableOne from 'lib/external/tables/table_one';
import config from 'lib/config';
import * as imageRepresentation from 'lib/service/representations/image';
import * as serviceErrors from 'lib/service/errors';


export interface GetImagesOpts {
  tag?: string;
  start?: string;
}

export interface GetImagesResult {
  images: imageRepresentation.Image[] | imageRepresentation.ImageWithTags[];
  last?: string;
}


export const getImages = async (opts: GetImagesOpts): Promise<GetImagesResult> => {
  const tableOneClient = new tableOne.TableOne(config.tableName, config.basicAWSConfig);

  try {
    if (opts.tag) {
      const result = await tableOneClient.getPageOfImagesByTag(
        opts.tag, config.getImagesByTagPageSize, opts.start);

      return {
        images: result.items.map(
          item => imageRepresentation.createImage(item, config.imgStorePrefix)),
        last: result.last,
      };
    }
    else {
      const result = await tableOneClient.getPageOfImages(
        config.getImagesPageSize, opts.start);

      return {
        images: result.items.map(
          item => imageRepresentation.createImageWithTags(item, config.imgStorePrefix)),
        last: result.last,
      };
    }
  }
  catch (err) {
    console.error(err);

    const errMessage = 'Failed to retrieve images from the database';

    if (tableOne.isExternalFailure(err))
      throw new serviceErrors.ExternalServerError(errMessage);

    throw new serviceErrors.InternalError(errMessage);
  }
};
