import * as storage from 'lib/external/storage';
import config from 'lib/config';
import * as serviceErrors from 'lib/service/errors';


export interface GetUploadsOpts {
  start?: string;
}

export interface UploadEntry {
  imageId: string;
  url: string;
  lastModified: number;
  size: number;
}

export interface GetUploadsResult {
  entries: UploadEntry[];
  last?: string;
}


export const getUploads = async (opts: GetUploadsOpts): Promise<GetUploadsResult> => {
  const storageClient = new storage.Storage(config.bucketName, config.basicAWSConfig);

  try {
    const result =
    await storageClient.listObjects(
      config.uploadsStorePrefix, config.getUploadsPageSize, opts.start);

    return {
      entries: result.entries.map(entry => ({
        imageId     : entry.key.substr(entry.key.lastIndexOf('/') + 1),
        url         : storageClient.createSignedGetUrl(entry.key),
        lastModified: entry.lastModified.getTime(),
        size        : entry.size,
      })),
      last: result.last,
    };
  }
  catch (err) {
    console.error(err);

    const errMessage = 'Failed to list storage objects';

    if (storage.isExternalFailure(err))
      throw new serviceErrors.ExternalServerError(errMessage);

    throw new serviceErrors.InternalError(errMessage);
  }
};
