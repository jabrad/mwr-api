import * as assert from 'assert';
import DynamoDB from '~seams/dynamodb';
import * as types from '../types';
import * as retryQueue from '../retry_queue';
import * as table from '../table';
import * as def from './definition';
import * as imageResource from 'lib/service/resources/image';
import * as tagsResource from 'lib/service/resources/tags';


export interface ItemPage<T> {
  items: T[];
  last?: string;
}


export class TableOne extends table.Table {
  async putImage(
    transformed: imageResource.TransformedImage,
    base: imageResource.BaseImage,
    queue: retryQueue.Queue,
  ): Promise<void> {
    const indexedItem = def.encodeIndexed(transformed);
    const transItem = def.encodeTransformed(transformed, indexedItem);
    const baseItem = def.encodeBase(base);

    // Put 'base' and 'transformed' items
    await this.ddb.transactWriteItems({
      TransactItems: [
        {
          Put: {
            TableName: this.table,
            Item     : def.withTableSortKey(transItem, def.InternalCollections.all),
          },
        },
        {
          Put: {
            TableName: this.table,
            Item     : def.withTableSortKey(baseItem, def.InternalCollections.base),
          },
        },
      ],
    }).promise();

    // Put 'indexed' items
    await this.writeTransactionWithBackoff({
      TransactItems: [
        {
          ConditionCheck: {
            TableName                : this.table,
            Key                      : def.makeTransformedPrimaryKey(transformed.imageId),
            ConditionExpression      : `attribute_exists(${def.TABLE_PK}) AND ${def.IndexedAttributeNameMap.order} = :order`,
            ExpressionAttributeValues: {
              ':order': types.encodeUInt32(transformed.order),
            },
          },
        },
        ...transformed.tags.map(tag => ({
          Put: {
            TableName: this.table,
            Item     : def.withTableSortKey(indexedItem, tag),
          },
        })),
      ],
    }, queue);

    // Increment tags' count; TODO: wrap tagging in a batch
    const tagsIncrements = transformed.tags.map(tag => this.updateWithBackoff({
      TableName                : this.table,
      Key                      : def.makeTagsPrimaryKey(tag, transformed.imageId),
      UpdateExpression         : `ADD ${def.TagsAttributeNameMap.refs} :1`,
      ExpressionAttributeValues: { ':1': types.encodeNumber(1) },
    }, queue));

    await Promise.all(tagsIncrements); // TODO: clean up if any fails
  }

  async deleteImage(
    imageId: string,
    queue: retryQueue.Queue,
  ): Promise<imageResource.TransformedImage | undefined> {
    const deletionResult = await this.ddb.deleteItem({
      TableName   : this.table,
      Key         : def.makeTransformedPrimaryKey(imageId),
      ReturnValues: 'ALL_OLD',
    }).promise();

    if (!deletionResult.Attributes)
      return;

    const transformed = def.decodeTransformed(deletionResult.Attributes);

    const deletionOfBase = this.deleteWithBackoff({
      TableName: this.table,
      Key      : def.makeBasePrimaryKey(imageId),
    }, queue);

    const deletionsOfIndexed = transformed.tags.map(tag => this.deleteWithBackoff({
      TableName: this.table,
      Key      : def.makeIndexedPrimaryKey(imageId, tag),
    }, queue));

    const tagCountUpdates = transformed.tags.map(tag => this.updateWithBackoff({
      TableName                : this.table,
      Key                      : def.makeTagsPrimaryKey(tag, imageId),
      ConditionExpression      : `attribute_exists(${def.TABLE_PK})`,
      UpdateExpression         : `SET ${def.TagsAttributeNameMap.refs} = ${def.TagsAttributeNameMap.refs} - :1`,
      ExpressionAttributeValues: { ':1': types.encodeNumber(1) },
    }, queue));

    // TODO: wrap in a batch, and handle errors
    await Promise.allSettled([deletionOfBase, ...deletionsOfIndexed, ...tagCountUpdates]);

    return transformed;
  }

  async updateImageOrder(
    imageId: string,
    order: number,
    queue: retryQueue.Queue,
  ): Promise<boolean> {
    const newOrder = types.encodeUInt32(order);

    const updateResult = await this.ddb.updateItem({
      TableName                : this.table,
      Key                      : def.makeTransformedPrimaryKey(imageId),
      ConditionExpression      : `attribute_exists(${def.TABLE_PK})`,
      UpdateExpression         : `SET ${def.IndexedAttributeNameMap.order} = :order`,
      ExpressionAttributeValues: {
        ':order': newOrder,
      },
      ReturnValues: 'ALL_NEW',
    }).promise().catch((err) => {
      if (err.code === 'ConditionalCheckFailedException')
        return;
      else
        throw err;
    });

    if (!updateResult)
      return false;

    assert(updateResult.Attributes);

    const transformed = def.decodeTransformed(updateResult.Attributes);
    const indexed = def.encodeIndexed(transformed);

    await this.writeTransactionWithBackoff({
      TransactItems: [
        {
          ConditionCheck: {
            TableName                : this.table,
            Key                      : def.makeTransformedPrimaryKey(imageId),
            ConditionExpression      : `attribute_exists(${def.TABLE_PK}) AND ${def.IndexedAttributeNameMap.order} = :order`,
            ExpressionAttributeValues: {
              ':order': newOrder,
            },
          },
        },
        ...transformed.tags.map(tag => ({
          Put: {
            TableName: this.table,
            Item     : def.withTableSortKey(indexed, tag),
          },
        })),
      ],
    }, queue);

    return true;
  }

  private async getPageOf
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <T extends(item: DynamoDB.AttributeMap) => any, R extends ReturnType<T>>(
    transformer: T, collection: string, limit?: number, start?: string)
    : Promise<ItemPage<R>> {

    const result = await this.ddb.query({
      TableName                : this.table,
      IndexName                : def.C_OVERLOAD_INDEX,
      KeyConditionExpression   : `${def.C_OVERLOAD_PK} = :collection`,
      ExpressionAttributeValues: {
        ':collection': { S: collection },
      },
      Limit            : limit,
      ExclusiveStartKey: start ?
        decodePageOfImagesStartToken(start, collection) : undefined,
      ScanIndexForward: false,
    }).promise();

    assert(result.Items);

    return {
      items: result.Items.map(transformer),
      last : result.LastEvaluatedKey
        && encodePageOfImagesStartToken(result.LastEvaluatedKey),
    };
  }

  getPageOfImages(limit?: number, start?: string)
    : Promise<ItemPage<imageResource.TransformedImage>> {

    return this.getPageOf(
      def.decodeTransformed,
      def.InternalCollections.all,
      limit,
      start,
    );
  }

  getPageOfImagesByTag(tag: string, limit?: number, start?: string)
    : Promise<ItemPage<imageResource.IndexedImage>> {

    return this.getPageOf(
      def.decodeIndexed,
      tag,
      limit,
      start,
    );
  }

  async getBase(imageId: string): Promise<imageResource.BaseImage | undefined> {
    const result = await this.ddb.getItem({
      TableName: this.table,
      Key      : def.makeBasePrimaryKey(imageId),
    }).promise();

    return result.Item && def.decodeBase(result.Item);
  }

  async getTransformed(imageId: string)
    : Promise<imageResource.TransformedImage | undefined> {

    const result = await this.ddb.getItem({
      TableName: this.table,
      Key      : def.makeTransformedPrimaryKey(imageId),
    }).promise();

    return result.Item && def.decodeTransformed(result.Item);
  }

  async getTags(): Promise<tagsResource.Tags> {
    const result = await this.ddb.query({
      TableName                : this.table,
      KeyConditionExpression   : `${def.TABLE_PK} = :tags_pk`,
      ExpressionAttributeValues: {
        ':tags_pk': def.encodeId(def.IdTypes.tag),
      },
    }).promise();

    assert(result.Items);

    const tags = result.Items.map(item => def.decodeShardedTag(item));

    return def.mergeShardedTags(tags);
  }
}


const START_TOKEN_DELIMITER = ';';

const decodePageOfImagesStartToken = (token: string, collection: string)
: DynamoDB.Key => {
  const [imageId, order] = token.split(START_TOKEN_DELIMITER);

  assert(imageResource.testId(imageId));
  assert(Number.isInteger(Number(order)));

  return {
    [def.IndexedAttributeNameMap.imageId]: def.encodeImageId(imageId),
    [def.C_OVERLOAD_PK]                  : types.encodeString(collection),
    [def.IndexedAttributeNameMap.order]  : types.encodeUInt32(Number(order)),
  };
};

const encodePageOfImagesStartToken = (key: DynamoDB.Key): string =>
  def.decodeImageId(key[def.IndexedAttributeNameMap.imageId]) + START_TOKEN_DELIMITER +
    types.decodeUInt32(key[def.IndexedAttributeNameMap.order]);

export { isExternalFailure } from '../table';
