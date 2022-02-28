import * as assert from 'assert';
import DynamoDB from '~seams/dynamodb';
import * as types from '../types';
import type * as imageResource from 'lib/service/resources/image';
import type * as tagsResource from 'lib/service/resources/tags';


export interface Tag {
  name: string;
  count: number;
}

export interface ShardedTag extends Tag {
  shard: string;
}


export const TABLE_PK = 'a';
export const TABLE_SK = 'b';

export const C_OVERLOAD_PK = TABLE_SK;
export const C_OVERLOAD_INDEX = 'c-overload';


export const enum IdTypes {
  image,
  tag,
}

export const enum BaseAttributeNameMap {
  imageId = 'a',
  width = 'z',
  height = 'y',
  size = 'x',
  filename = 'w',
  format = 'v',
  transform = 'u',
  uploadDate = 't',
}

export const enum IndexedAttributeNameMap {
  imageId = 'a',
  order = 'c',
  thumbnail = 'z',
  sizes = 'y',
  formats = 'x',
}

export const enum TransformedAttributeNameMap {
  tags = 'w',
}

export const enum TagsAttributeNameMap {
  id = 'b',
  refs = 'z',
}

export const enum InternalCollections {
  all = '_',
  base = '_b',
}

export const _decodeId = (id: Buffer, idType: IdTypes): Buffer => {
  assert(id[0] === idType);

  return id.subarray(1);
};

export const decodeId =
(attribute: DynamoDB.AttributeValue, idType: IdTypes, length?: number): Buffer => {
  const id = types.decodeBinary(
    attribute,
    (length !== undefined) ? (length + 1) : undefined);

  return _decodeId(id, idType);
};


export const _encodeId = (idType: IdTypes, id?: Buffer): Buffer => {
  if (id)
    return Buffer.concat([new Uint8Array([idType]), id]);
  else
    return Buffer.from([idType]);
};

export const encodeId = (idType: IdTypes, id?: Buffer): DynamoDB.AttributeValue =>
  types.encodeBinary(_encodeId(idType, id));


export const decodeImageId = (attribute: DynamoDB.AttributeValue): string =>
  decodeId(attribute, IdTypes.image, 16).toString('hex');

const _encodeImageId = (imageId: string): Buffer =>
  _encodeId(IdTypes.image, Buffer.from(imageId, 'hex'));

export const encodeImageId = (imageId: string): DynamoDB.AttributeValue =>
  encodeId(IdTypes.image, Buffer.from(imageId, 'hex'));


export const decodeBase = (item: DynamoDB.AttributeMap): imageResource.BaseImage => ({
  imageId   : decodeImageId(item[BaseAttributeNameMap.imageId]),
  uploadDate: types.decodeDate(item[BaseAttributeNameMap.uploadDate]),
  width     : types.decodeUInt16(item[BaseAttributeNameMap.width]),
  height    : types.decodeUInt16(item[BaseAttributeNameMap.height]),
  size      : types.decodeUInt32(item[BaseAttributeNameMap.size]),
  filename  : types.decodeString(item[BaseAttributeNameMap.filename]),
  format    : types.decodeString(item[BaseAttributeNameMap.format]),
  transform : types.decodeString(item[BaseAttributeNameMap.transform]),
});

export const encodeBase = (base: imageResource.BaseImage): DynamoDB.AttributeMap => ({
  [BaseAttributeNameMap.imageId]   : encodeImageId(base.imageId),
  [BaseAttributeNameMap.uploadDate]: types.encodeDate(base.uploadDate),
  [BaseAttributeNameMap.width]     : types.encodeUInt16(base.width),
  [BaseAttributeNameMap.height]    : types.encodeUInt16(base.height),
  [BaseAttributeNameMap.size]      : types.encodeUInt32(base.size),
  [BaseAttributeNameMap.filename]  : types.encodeString(base.filename),
  [BaseAttributeNameMap.format]    : types.encodeString(base.format),
  [BaseAttributeNameMap.transform] : types.encodeString(base.transform),
});


export const decodeIndexed = (item: DynamoDB.AttributeMap)
: imageResource.IndexedImage => ({
  imageId  : decodeImageId(item[IndexedAttributeNameMap.imageId]),
  order    : types.decodeUInt32(item[IndexedAttributeNameMap.order]),
  formats  : types.decodeStringSet(item[IndexedAttributeNameMap.formats]),
  sizes    : types.decodeUInt16PairSet(item[IndexedAttributeNameMap.sizes]),
  thumbnail: types.decodeUInt16Pair(item[IndexedAttributeNameMap.thumbnail]),
});

export const encodeIndexed = (indexed: imageResource.IndexedImage)
: DynamoDB.AttributeMap => ({
  [IndexedAttributeNameMap.imageId]  : encodeImageId(indexed.imageId),
  [IndexedAttributeNameMap.order]    : types.encodeUInt32(indexed.order),
  [IndexedAttributeNameMap.formats]  : types.encodeStringSet(indexed.formats),
  [IndexedAttributeNameMap.sizes]    : types.encodeUInt16PairSet(indexed.sizes),
  [IndexedAttributeNameMap.thumbnail]: types.encodeUInt16Pair(indexed.thumbnail),
});


export const decodeTransformed = (item: DynamoDB.AttributeMap)
: imageResource.TransformedImage => ({
  ...decodeIndexed(item),
  tags: types.decodeStringSet(item[TransformedAttributeNameMap.tags]),
});

export const encodeTransformed =
(trans: imageResource.TransformedImage, encodedIndexed?: DynamoDB.AttributeMap)
: DynamoDB.AttributeMap => ({
  ...(encodedIndexed || encodeIndexed(trans)),
  [TransformedAttributeNameMap.tags]: types.encodeStringSet(trans.tags),
});


export const decodeShardedTag = (item: DynamoDB.AttributeMap): ShardedTag => {
  const id = types.decodeString(item[TagsAttributeNameMap.id]);

  return {
    name : id.substr(0, id.length - 1),
    shard: id.substr(-1),
    count: types.decodeNumber(item[TagsAttributeNameMap.refs]),
  };
};


export const makePrimaryKey = (partitionKey: Buffer, sortKey: string): DynamoDB.Key => ({
  [TABLE_PK]: { B: partitionKey },
  [TABLE_SK]: { S: sortKey },
});


export const makeBasePrimaryKey = (imageId: string): DynamoDB.Key =>
  makePrimaryKey(_encodeImageId(imageId), InternalCollections.base);

export const makeTransformedPrimaryKey = (imageId: string): DynamoDB.Key =>
  makePrimaryKey(_encodeImageId(imageId), InternalCollections.all);

export const makeIndexedPrimaryKey = (imageId: string, tag: string): DynamoDB.Key =>
  makePrimaryKey(_encodeImageId(imageId), tag);

/**
 * imageId is used for write sharding. Specifically it's first 4 bits
 */
export const makeTagsPrimaryKey = (tag: string, imageId: string): DynamoDB.Key =>
  makePrimaryKey(_encodeId(IdTypes.tag), tag + imageId[0]);


export const withTableSortKey =
(item: DynamoDB.AttributeMap, value: string): DynamoDB.AttributeMap => ({
  ...item,
  [TABLE_SK]: types.encodeString(value),
});


export const mergeShardedTags = (shards: ShardedTag[]): tagsResource.Tags => {
  const tags: tagsResource.Tags = {};

  for (const shard of shards)
    tags[shard.name] = (tags[shard.name] ?? 0) + shard.count;

  return tags;
};
