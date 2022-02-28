import config from 'lib/config';
import { partial } from 'lib/functional';
import * as image from 'lib/image';
import Mime from 'lib/mime';
import * as promise from 'lib/promise';
import * as storage from 'lib/external/storage';
import * as retryQueue from 'lib/external/tables/retry_queue';
import * as tableOne from 'lib/external/tables/table_one';
import type * as stream from 'stream';
import * as serviceErrors from 'lib/service/errors';
import * as imageRepresentation from 'lib/service/representations/image';
import * as imageResource from 'lib/service/resources/image';


type SupportedFormats = 'jpeg' | 'webp';


interface FormattedStream<T extends string> {
  format: T;
  stream: stream.Readable;
}

interface OutputImage<T extends string> {
  width: number;
  height: number;
  formats: FormattedStream<T>[];
}

interface OutputImages<T extends string> {
  standard: OutputImage<T>[];
  thumbnail: OutputImage<T>;
}

export interface ImageTransformOpts {
  resize?: image.Dimensions[];
  crop?: image.AngularCropOpts | image.CropOpts;
  thumbnail: image.ThumbnailOpts;
}

export interface PostImageOpts extends ImageTransformOpts {
  baseImageId: string;
  fromUpload: boolean;
  order: number;
  tags: string[];
}


const createOutputImage =
<T extends SupportedFormats>(pipeline: image.RawImgReadable, formats: T[])
: OutputImage<T> => ({
  width  : pipeline.rawImgSpec.width,
  height : pipeline.rawImgSpec.height,
  formats: formats.map(format => ({
    format,
    stream: image.pipeline(pipeline, partial(image.format, format)),
  })),
});


const transformImage = <T extends SupportedFormats>(
  sourceStream: image.RawImgDuplex,
  opts: ImageTransformOpts,
  formats: T[],
): OutputImages<T> => {
  // Create the main pipeline, potentially cropping the base image

  let crop: image.BoundRawImgTransform<image.RawImgDuplex> | undefined;

  if (opts.crop) {
    if ('angle' in opts.crop)
      crop = partial(image.angularCrop, opts.crop);
    else
      crop = partial(image.crop, opts.crop);
  }

  let mainTransformPipeline: image.RawImgReadable;

  if (crop)
    mainTransformPipeline = image.pipeline(sourceStream, crop);
  else
    mainTransformPipeline = sourceStream;

  // Create resize pipelines, if any

  const resizePipelines: image.RawImgReadable[] = [];

  if (opts.resize) {
    for (let i = 0; i < opts.resize.length; ++i) {
      resizePipelines.push(
        image.pipeline(mainTransformPipeline, partial(image.resize, opts.resize[i])));
    }
  }
  else {
    resizePipelines.push(mainTransformPipeline);
  }

  // Create a thumbnail pipeline

  const thumbnail = partial(image.thumbnail, opts.thumbnail);

  const thumbnailPipeline = image.pipeline(mainTransformPipeline, thumbnail);

  // Return formatted pipelines

  return {
    standard : resizePipelines.map(pipeline => createOutputImage(pipeline, formats)),
    thumbnail: createOutputImage(thumbnailPipeline, formats),
  };
};


const prepareOutputImageForUpload =
(partialKey: string, image: OutputImage<SupportedFormats>): storage.BatchUploadItem[] =>
  image.formats.map(format => ({
    key        : imageResource.makeFullKey(partialKey, format.format),
    value      : format.stream,
    contentType: Mime[format.format],
  }));



export const postImage = async (opts: PostImageOpts)
: Promise<imageRepresentation.ImageWithTags> => {

  const storageClient = new storage.Storage(config.bucketName, config.basicAWSConfig);
  const queueClient = new retryQueue.Queue(config.ddbQueueUrl, config.basicAWSConfig);
  const tableOneClient = new tableOne.TableOne(config.tableName, config.basicAWSConfig);

  const imageId = imageResource.generateId();

  console.log('New image id:', imageId);

  const baseImgKey =
    `${opts.fromUpload ? config.uploadsStorePrefix : config.rawImgStorePrefix}${opts.baseImageId}`;
  const copyImgKey =
    `${config.rawImgStorePrefix}${imageId}`;

  const promisedCopy = storageClient.copyObject(baseImgKey, copyImgKey);
  const promisedBaseImg = storageClient.getObject(baseImgKey);

  promise.suppressRejection(promisedBaseImg);

  let copyETag: string;

  try {
    copyETag = await promisedCopy;
  }
  catch (err) {
    console.error(err);

    if (storage.isNotFound(err))
      throw new serviceErrors.NoSuchImage(baseImgKey);

    const errMessage = `Failed to copy from ${baseImgKey} to ${copyImgKey}`;

    if (storage.isExternalFailure(err))
      throw new serviceErrors.ExternalServerError(errMessage);

    throw new serviceErrors.InternalError(errMessage);
  }

  let baseImg: storage.StorageObject;

  try {
    baseImg = await promisedBaseImg;

    // Check whether base etag and copy etag are different.
    // This probably will never happen.
    if (baseImg.eTag !== copyETag) {
      console.log('Base etag and copy etag do not match');

      throw 0; // Throw anything just to jump into the catch statement
    }
  }
  catch (err) {
    console.error(err);

    try {
      // Retrieve base image from its successful copy.
      baseImg = await storageClient.getObject(copyImgKey);
    }
    catch (err) {
      console.error(err);

      throw new serviceErrors.InternalError('Failed to retrieve the copy');
    }
  }

  let baseImgMetadata: image.Metadata;

  try {
    baseImgMetadata = await image.getMetadata(baseImg.data);
  }
  catch (err) {
    console.error(err);

    if (err instanceof Error && err.message.includes('unsupported image format'))
      throw new serviceErrors.UnsupportedImageFormat();

    throw new serviceErrors.InternalError('Failed to retrieve image metadata');
  }

  // Transform images

  const toRaw = image.toRaw(baseImg.data, baseImgMetadata);

  let outputImages: OutputImages<SupportedFormats>;

  try {
    outputImages = transformImage(toRaw, opts, ['jpeg', 'webp']);
  }
  catch (err) {
    // TODO: Some, if not all, checks can be made without a source image.
    //       Anticipate them before operating on storage.
    console.error(err);

    if (err instanceof image.InvalidOpts)
      throw new serviceErrors.InvalidOpts(err.message);
    else
      throw new serviceErrors.InternalError('Failed to transform an image');
  }

  // Upload images

  const baseKey = config.imgStorePrefix + imageId;

  const toUpload = outputImages.standard.flatMap(image => prepareOutputImageForUpload(
    imageResource.makeStandardPartialKey(baseKey, image.width, image.height), image));

  toUpload.push(...prepareOutputImageForUpload(
    imageResource.makeThumbnailPartialKey(baseKey), outputImages.thumbnail));

  try {
    await Promise.all(storageClient.batchUpload(toUpload));
  }
  catch (err) {
    console.error(err);

    const errMessage = 'Uploads failed';

    if (storage.isExternalFailure(err))
      throw new serviceErrors.ExternalServerError(errMessage);

    throw new serviceErrors.InternalError(errMessage);
  }

  // Remove base image if it's an upload

  let promisedRemove: Promise<void> | undefined;

  if (opts.fromUpload) {
    promisedRemove = storageClient.deleteObject(baseImgKey);

    promise.suppressRejection(promisedRemove);
  }

  // Put data about the image into the database

  const transformedImage: imageResource.TransformedImage = {
    imageId,
    order    : opts.order,
    formats  : ['jpeg', 'webp'],
    thumbnail: [outputImages.thumbnail.width, outputImages.thumbnail.height],
    sizes    : outputImages.standard.map(image => [image.width, image.height]),
    tags     : opts.tags,
  };

  console.log('Transformed image item:', transformedImage);

  const baseImage: imageResource.BaseImage = {
    imageId,
    uploadDate: new Date(),
    width     : baseImgMetadata.width,
    height    : baseImgMetadata.height,
    size      : baseImg.data.byteLength,
    filename  : baseImg.meta.filename || '',
    format    : baseImgMetadata.format,
    transform : JSON.stringify(opts),
  };

  console.log('Base image item:', baseImage);

  try {
    await tableOneClient.putImage(transformedImage, baseImage, queueClient);
  }
  catch (err) {
    console.error(err);

    const errMessage = 'Failed to put an item into the database';

    if (tableOne.isExternalFailure(err))
      throw new serviceErrors.ExternalServerError(errMessage);

    throw new serviceErrors.InternalError(errMessage);
  }

  // Await the removal of the base image if it was anticipated.
  // Failure to delete base image does not violate the integrity of successfully
  // added images, thus can be ingored.
  if (promisedRemove) {
    try {
      await promisedRemove;
    }
    catch (err) {
      console.error(err);
      console.error('Failed to delete image:', baseImgKey);
    }
  }

  return imageRepresentation.createImageWithTags(transformedImage, config.imgStorePrefix);
};
