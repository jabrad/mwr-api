import * as tableOne from 'lib/external/tables/table_one';
import * as retryQueue from 'lib/external/tables/retry_queue';
import config from 'lib/config';
import * as serviceErrors from 'lib/service/errors';


export interface ChangeImageOrderOpts {
  imageId: string;
  order: number;
}


export const changeImageOrder = async (opts: ChangeImageOrderOpts): Promise<void> => {
  const tableOneClient = new tableOne.TableOne(config.tableName, config.basicAWSConfig);
  const queueClient = new retryQueue.Queue(config.ddbQueueUrl, config.basicAWSConfig);

  try {
    const result =
      await tableOneClient.updateImageOrder(opts.imageId, opts.order, queueClient);

    if (!result)
      throw new serviceErrors.NoSuchImage(opts.imageId);
  }
  catch (err) {
    console.error(err);

    if (tableOne.isExternalFailure(err))
      throw new serviceErrors.ExternalServerError('Failed to put an item into the database due to a database failure');

    throw new serviceErrors.InternalError('Failed to put an item into the database');
  }
};
