import SQS from '~seams/sqs';
import { getExpontentialBackoff } from 'lib/retry';
import * as assert from 'assert';
import * as config from 'lib/config';
import * as json from 'lib/json';
import * as hashing from 'lib/hashing';


interface RequestAttempt<T> {
  attempt: number;
  base: number;
  request: T;
}

interface PromiseHandlers {
  resolve: (value: void) => void;
  reject: (reason?: unknown) => void;
}

type SendMessageRequest = Omit<SQS.SendMessageRequest, 'QueueUrl'>;
type DeleteMessageRequest = Omit<SQS.DeleteMessageRequest, 'QueueUrl'>;

interface SendRequest extends PromiseHandlers {
  request: SendMessageRequest;
}

interface DeleteRequest extends PromiseHandlers {
  request: DeleteMessageRequest;
}

// NOTE: this interface is incomplete
// NOTE: this interface is incompatible with SQS.Message as they differ in casing
export interface SqsMessage {
  messageId: string;
  receiptHandle: string;
  md5OfBody: string;
  body: string;
}


const MAX_MESSAGE_DELAY = 900; // [seconds]


export class Queue {
  protected sqs: SQS;
  protected url: string;
  private sendRequests: SendRequest[] = [];
  private deleteRequests: DeleteRequest[] = [];

  constructor(url: string, sqsConfig?: SQS.ClientConfiguration) {
    this.sqs = new SQS(sqsConfig);
    this.url = url;
  }

  private dispatchSendRequests() {
    const requests = this.sendRequests;

    this.sendRequests = [];

    if (requests.length === 1) {
      const request = requests[0];

      this.sqs
        .sendMessage({
          ...request.request,
          QueueUrl: this.url,
        })
        .promise()
        .then(() => request.resolve(), request.reject);
    }
    else {
      this.sqs
        .sendMessageBatch({
          QueueUrl: this.url,
          Entries : requests
            .map((request, i) => ({ ...request.request, Id: String(i) })),
        })
        .promise()
        .then((result) => {
          for (const success of result.Successful)
            requests[Number(success.Id)].resolve();

          for (const failure of result.Failed) {
            const request = requests[Number(failure.Id)];

            if (failure.SenderFault)
              request.reject(failure);
            else
              this.sendMessage(request.request).then(request.resolve, request.reject);
          }
        }, (err) => {
          for (const request of requests)
            request.reject(err);
        });
    }
  }

  private dispatchDeleteRequests() {
    const requests = this.deleteRequests;

    this.deleteRequests = [];

    if (requests.length === 1) {
      const request = requests[0];

      this.sqs
        .deleteMessage({
          ...request.request,
          QueueUrl: this.url,
        })
        .promise()
        .then(() => request.resolve(), request.reject);
    }
    else {
      this.sqs
        .deleteMessageBatch({
          QueueUrl: this.url,
          Entries : requests
            .map((request, i) => ({ ...request.request, Id: String(i) })),
        })
        .promise()
        .then((result) => {
          for (const success of result.Successful)
            requests[Number(success.Id)].resolve();

          for (const failure of result.Failed) {
            const request = requests[Number(failure.Id)];

            if (failure.SenderFault)
              request.reject(failure);
            else
              this.deleteMessage(request.request).then(request.resolve, request.reject);
          }
        }, (err) => {
          for (const request of requests)
            request.reject(err);
        });
    }
  }

  sendMessage(request: SendMessageRequest): Promise<void> {
    if (!this.sendRequests.length)
      process.nextTick(() => this.dispatchSendRequests());

    if (this.sendRequests.length === 10)
      this.dispatchSendRequests();

    return new Promise<void>((resolve, reject) => {
      this.sendRequests.push({ request, resolve, reject });
    });
  }

  deleteMessage(request: DeleteMessageRequest): Promise<void> {
    if (!this.deleteRequests.length)
      process.nextTick(() => this.dispatchDeleteRequests());

    if (this.deleteRequests.length === 10)
      this.dispatchDeleteRequests();

    return new Promise<void>((resolve, reject) => {
      this.deleteRequests.push({ request, resolve, reject });
    });
  }
}


export class BackoffQueue<T> extends Queue {
  constructor(url: string, awsConfig: config.BasicAWSConfig) {
    super(url, {
      ...awsConfig,
      apiVersion: '2012-11-05',
      region    : awsConfig.region,
    });
  }

  /**
   * @param base [milliseconds]
   */
  enqueue(request: T, base: number, attempts = 0): Promise<void> {
    const requestAttempt: RequestAttempt<T> = {
      attempt: attempts + 1,
      base,
      request,
    };

    const delay = Math.ceil(getExpontentialBackoff(attempts, base) / 1000); // [seconds]

    return this.sendMessage({
      MessageBody : JSON.stringify(requestAttempt, json.encodeBufferBase64),
      DelaySeconds: Math.min(delay, MAX_MESSAGE_DELAY),
    });
  }

  dequeue(messageHandler: string): Promise<void> {
    return this.deleteMessage({
      ReceiptHandle: messageHandler,
    });
  }
}


export class BackoffMessage<T> {
  private queue: BackoffQueue<T>;
  private message: SqsMessage;
  private requestAttempt: RequestAttempt<T>;

  constructor(queue: BackoffQueue<T>, message: SqsMessage) {
    this.queue = queue;
    this.message = message;

    assert(hashing.checkMd5(message.body, message.md5OfBody));

    // TODO: validate
    this.requestAttempt = JSON.parse(message.body, json.decodeBufferBase64);
  }

  async remove(): Promise<void> {
    assert(this.message.receiptHandle);

    await this.queue.dequeue(this.message.receiptHandle);
  }

  async delay(dontRemove = false): Promise<void> {
    await this.queue.enqueue(
      this.requestAttempt.request,
      this.requestAttempt.base,
      this.requestAttempt.attempt,
    );

    if (!dontRemove)
      await this.remove();
  }

  get request(): T {
    return this.requestAttempt.request;
  }
}
