import * as config from 'lib/config';

import S3 from '~seams/s3';
import * as stream from 'stream';
import * as assert from 'assert';


export interface StorageObject {
  data: Buffer;
  eTag: string;
  meta: {[key: string]: string | undefined};
}

export type SendableTypes = Uint8Array | stream.Readable;

export interface BatchUploadItem {
  key: string;
  value: SendableTypes;
  contentType?: string;
}

export interface StorageObjectEntry {
  key: string;
  lastModified: Date;
  eTag: string;
  size: number;
}

export interface ListingResult {
  entries: StorageObjectEntry[];
  last?: string;
}

export type PresignedPost = S3.PresignedPost;

// NOTE: due to vague sdk documentation, there are many,
// probably unnecessary, assertions


export class Storage {
  private s3: S3;
  private bucket: string;

  constructor(bucket: string, awsConfig: config.BasicAWSConfig) {
    this.bucket = bucket;

    this.s3 = new S3({
      ...awsConfig,
      apiVersion: '2006-03-01',
      region    : config.default.devBucketRegion || awsConfig.region,
    });
  }

  async getObject(key: string): Promise<StorageObject> {
    const response = await this.s3.getObject({
      Key   : key,
      Bucket: this.bucket,
    }).promise();

    assert(response.ETag);
    assert(response.Metadata);

    return {
      data: response.Body as Buffer,
      eTag: response.ETag,
      meta: response.Metadata,
    };
  }

  async putObject(key: string, value: SendableTypes, contentType?: string)
    : Promise<string> {

    const response = await this.s3.putObject({
      Bucket     : this.bucket,
      Key        : key,
      Body       : value,
      ContentType: contentType,
    }).promise();

    assert(response.ETag);

    return response.ETag;
  }

  async uploadObject(key: string, value: SendableTypes, contentType?: string)
    : Promise<string> {

    const response = await this.s3.upload({
      Bucket     : this.bucket,
      Key        : key,
      Body       : value,
      ContentType: contentType,
    }).promise();

    assert(response.ETag);

    return response.ETag;
  }

  batchUpload(items: BatchUploadItem[]): Promise<string>[] {
    return items
      .map(item => this.uploadObject(item.key, item.value, item.contentType));
  }

  async deleteObject(key: string): Promise<void> {
    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key   : key,
    }).promise();
  }

  batchDelete(items: string[]): Promise<void>[] {
    return items
      .map(item => this.deleteObject(item));
  }

  async copyObject(srcKey: string, destKey: string): Promise<string> {
    const result = await this.s3.copyObject({
      Bucket    : this.bucket,
      CopySource: `${this.bucket}/${srcKey}`,
      Key       : destKey,
    }).promise();

    assert(result.CopyObjectResult);
    assert(result.CopyObjectResult.ETag);

    return result.CopyObjectResult.ETag;
  }

  async listObjects(prefix = '', limit?: number, start?: string): Promise<ListingResult> {
    const result = await this.s3.listObjectsV2({
      Bucket           : this.bucket,
      Prefix           : prefix,
      MaxKeys          : limit,
      ContinuationToken: start,
    }).promise();

    assert(result.Contents);

    return {
      entries: result.Contents.map(rawEntry => ({
        key         : rawEntry.Key!,
        lastModified: rawEntry.LastModified!,
        eTag        : rawEntry.ETag!,
        size        : rawEntry.Size!,
      })),
      last: result.NextContinuationToken,
    };
  }

  createSignedGetUrl(key: string, expires = 1800): string {
    const result = this.s3.getSignedUrl('getObject', <S3.GetObjectRequest>{
      Bucket : this.bucket,
      Key    : key,
      Expires: expires,
    });

    return result;
  }

  createImagePost(key: string, expires = 180): PresignedPost {
    return this.s3.createPresignedPost({
      Bucket: this.bucket,
      Fields: {
        key,
      },
      Conditions: [
        ['starts-with', '$Content-Type', 'image/'],
        ['starts-with', '$x-amz-meta-filename', ''],
      ],
      Expires: expires,
    });
  }
}


/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export const isExternalFailure = (err: any): boolean =>
  err && typeof err.statusCode === 'number' && err.statusCode >= 500;


export const isNotFound = (err: any): boolean =>
  err && typeof err.statusCode === 'number' && err.statusCode === 404;

/* eslint-enable */
