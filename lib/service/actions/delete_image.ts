import * as tableOne from 'lib/external/tables/table_one';
import * as retryQueue from 'lib/external/tables/retry_queue';
import config from 'lib/config';
import * as serviceErrors from 'lib/service/errors';
import * as storage from 'lib/external/storage';
import * as imageResource from 'lib/service/resources/image';


export interface DeleteImageOpts {
  imageId: string;
}


export const deleteImage = async (opts: DeleteImageOpts): Promise<void> => {
  const tableOneClient = new tableOne.TableOne(config.tableName, config.basicAWSConfig);
  const queueClient = new retryQueue.Queue(config.ddbQueueUrl, config.basicAWSConfig);
  const storageClient = new storage.Storage(config.bucketName, config.basicAWSConfig);

  // Delete image from the database

  let image: imageResource.TransformedImage;

  try {
    const maybeImage = await tableOneClient.deleteImage(opts.imageId, queueClient);

    if (!maybeImage)
      throw new serviceErrors.NoSuchImage(opts.imageId);

    image = maybeImage;
  }
  catch (err) {
    console.error(err);

    const errMessage = 'Failed to delete an image from the database';

    if (tableOne.isExternalFailure(err))
      throw new serviceErrors.ExternalServerError(errMessage);

    throw new serviceErrors.InternalError(errMessage);
  }

  console.log('Deleted image:', image.imageId);

  // Delete image files from the storage

  const baseKey = config.imgStorePrefix + opts.imageId;

  const imageFilesToRemove: string[] = image.sizes
    .flatMap(size => image.formats
      .map(format => imageResource.makeFullKey(
        imageResource.makeStandardPartialKey(baseKey, ...size), format)));

  imageFilesToRemove.push(...image.formats
    .map(format => imageResource.makeFullKey(
      imageResource.makeThumbnailPartialKey(baseKey), format)));

  const deletionResult
    = await Promise.allSettled(storageClient.batchDelete(imageFilesToRemove));

  for (let i = 0; i < deletionResult.length; ++i) {
    const result = deletionResult[i];

    if (result.status === 'rejected')
      console.error(`Failed to delete file ${imageFilesToRemove[i]}`, result.reason);
  }
};
