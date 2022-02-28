import DynamoDB from '~seams/dynamodb';
import { BackoffQueue, BackoffMessage, SqsMessage } from '../queue';
import type { AWSError } from 'aws-sdk';
import { isSingleWriteRetryable, isTransactionRetryable } from './response';


export interface PutRequest {
  type: 'put';
  params: DynamoDB.PutItemInput;
}

export interface DeleteRequest {
  type: 'delete';
  params: DynamoDB.DeleteItemInput;
}

export interface UpdateRequest {
  type: 'update';
  params: DynamoDB.UpdateItemInput;
}

export interface TransactionRequest {
  type: 'transaction';
  params: DynamoDB.TransactWriteItemsInput;
}

export type DynamoDBRequest =
  | PutRequest
  | DeleteRequest
  | UpdateRequest
  | TransactionRequest;


// Helper interface. It doesn't represent any actual object.
interface Responses {
  put: DynamoDB.PutItemOutput;
  delete: DynamoDB.DeleteItemOutput;
  update: DynamoDB.UpdateItemOutput;
  transaction: DynamoDB.TransactWriteItemsOutput;
}

export type Message = BackoffMessage<DynamoDBRequest>;


export class Queue extends BackoffQueue<DynamoDBRequest> {
  fromMessage(message: SqsMessage): Message {
    return new BackoffMessage(this, message);
  }
}


export const sendRequest = (ddb: DynamoDB, request: DynamoDBRequest)
: Promise<Responses[typeof request.type] | void> => {
  if (request.type === 'transaction') {
    return ddb.transactWriteItems(request.params).promise()
      .then(undefined, makePredicateThrow(isTransactionRetryable));
  }
  else {
    let req: AWS.Request<Responses[typeof request.type], AWSError>;

    switch (request.type) {
      case 'put':
        req = ddb.putItem(request.params); break;
      case 'delete':
        req = ddb.deleteItem(request.params); break;
      case 'update':
        req = ddb.updateItem(request.params); break;
    }

    return req.promise().then(undefined, makePredicateThrow(isSingleWriteRetryable));
  }
};


const makePredicateThrow = <T>(predicate: (input: T) => boolean) =>
  (input: T) => {
    if (!predicate(input))
      throw input;
  };
