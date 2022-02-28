import DynamoDB from '~seams/dynamodb';

import * as config from 'lib/config';
import * as retryQueue from './retry_queue';
import { isSingleWriteRetryable, isTransactionRetryable } from './response';


const BASE_DELAY_WINDOW = 100;


export const getDdbClient = (awsConfig: config.BasicAWSConfig): DynamoDB =>
  new DynamoDB({
    ...awsConfig,
    apiVersion: '2012-08-10',
    endpoint  : config.default.devDdbEndpoint, // Present in development environment
  });


export class Table {
  protected ddb: DynamoDB;
  protected table: string;

  constructor(table: string, awsConfig: config.BasicAWSConfig) {
    this.table = table;
    this.ddb = getDdbClient(awsConfig);
  }

  protected writeTransactionWithBackoff(
    params: DynamoDB.TransactWriteItemsInput,
    queue: retryQueue.Queue,
  ): Promise<DynamoDB.TransactWriteItemsOutput | void> {

    const ddb = new DynamoDB(this.ddb.config);

    ddb.config.update({ maxRetries: 0 });

    return new Promise((resolve, reject) => {
      ddb.transactWriteItems(params, (err, data) => {
        if (err) {
          if (isTransactionRetryable(err)) {
            queue.enqueue({
              type  : 'transaction',
              params: params,
            }, BASE_DELAY_WINDOW).then(resolve, reject);
          }
          else {
            reject(err);
          }
        }
        else {
          resolve(data);
        }
      });
    });
  }

  protected updateWithBackoff(params: DynamoDB.UpdateItemInput, queue: retryQueue.Queue)
    : Promise<DynamoDB.UpdateItemOutput | void> {

    const ddb = new DynamoDB(this.ddb.config);

    ddb.config.update({ maxRetries: 0 });

    return new Promise((resolve, reject) => {
      ddb.updateItem(params, (err, data) => {
        if (err) {
          if (isSingleWriteRetryable(err)) {
            queue.enqueue({
              type  : 'update',
              params: params,
            }, BASE_DELAY_WINDOW).then(resolve, reject);
          }
          else {
            reject(err);
          }
        }
        else {
          resolve(data);
        }
      });
    });
  }

  protected deleteWithBackoff(params: DynamoDB.DeleteItemInput, queue: retryQueue.Queue)
    : Promise<DynamoDB.DeleteItemOutput | void> {
    const ddb = new DynamoDB(this.ddb.config);

    ddb.config.update({ maxRetries: 0 });

    return new Promise((resolve, reject) => {
      ddb.deleteItem(params, (err, data) => {
        if (err) {
          if (isSingleWriteRetryable(err)) {
            queue.enqueue({
              type  : 'delete',
              params: params,
            }, BASE_DELAY_WINDOW).then(resolve, reject);
          }
          else {
            reject(err);
          }
        }
        else {
          resolve(data);
        }
      });
    });
  }
}


/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export const isExternalFailure = (err: any): boolean =>
  err && typeof err.statusCode === 'number' && err.statusCode >= 500;

/* eslint-enable */
