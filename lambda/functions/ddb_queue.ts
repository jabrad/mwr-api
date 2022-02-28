import * as retryQueue from 'lib/external/tables/retry_queue';
import * as table from 'lib/external/tables/table';
import SQSEvent from './events/sqs';
import config from 'lib/config';


export const handler = async (event: SQSEvent): Promise<void> => {
  console.log(`Received ${event.Records.length} messages`);

  const queue = new retryQueue.Queue(config.ddbQueueUrl, config.basicAWSConfig);
  const ddb = table.getDdbClient(config.basicAWSConfig);

  ddb.config.update({
    maxRetries: 0,
  });

  const messages: retryQueue.Message[] = []; // Valid messages

  // Select valid messages
  for (const sqsMessage of event.Records) {
    try {
      const message = queue.fromMessage(sqsMessage);

      messages.push(message);
    }
    catch (err) {
      console.error('Invalid message:', sqsMessage);
    }
  }

  const requests = messages.map(message => retryQueue.sendRequest(ddb, message.request));
  const settledRequests = await Promise.allSettled(requests);

  console.log('All requests have settled');

  const numberOfInvalidMessages = event.Records.length - messages.length;
  let numberOfFailedRequests = 0;

  // Log and display failed requests
  for (const request of settledRequests) {
    if (request.status === 'rejected') {
      numberOfFailedRequests += 1;

      console.log('Failed request\n', request.reason);
    }
  }

  if (!numberOfInvalidMessages && !numberOfFailedRequests) {
    // In this context, removal of messages can be skipped and leveraged to Lambda,
    // unless any of delay actions fails.

    const delayActions: (Promise<void> | undefined)[] = [];

    let numberOfMessagesToDelay = 0;

    for (let i = 0; i < messages.length; ++i) {
      const message = messages[i];
      const result = settledRequests[i] as PromiseFulfilledResult<unknown>;

      if (result.value) {
        delayActions.push(undefined);
      }
      else {
        delayActions.push(message.delay(true/* dontRemove */));

        numberOfMessagesToDelay += 1;
      }
    }

    console.log(`Delaying ${numberOfMessagesToDelay} messages`);

    const settledDelayActions = await Promise.allSettled(delayActions);

    const numberOfFailedDelayActions = getNumberOfRejections(settledDelayActions);

    if (numberOfFailedDelayActions > 0) {
      // Due to an unsuccessful delay action, remove messages that would otherwise
      // be removed by Lambda.

      const removalActions: Promise<void>[] = [];

      for (let i = 0; i < messages.length; ++i) {
        if (
          !delayActions[i]
          || delayActions[i]
            && settledDelayActions[i].status === 'fulfilled'
        )
          removalActions.push(messages[i].remove());
      }

      const settledRemovalActions = await Promise.allSettled(removalActions);

      const numberOfFailedRemovalActions = getNumberOfRejections(settledRemovalActions);

      let errorMessage = `Failed to delay ${numberOfFailedDelayActions} messages\n`;

      if (numberOfFailedRemovalActions)
        errorMessage += numberOfFailedRemovalActions + ' following removals have failed\n';

      throw new Error(errorMessage);
    }
    else {
      console.log('Leveraging Lambda to delete received messages');
    }
  }
  else {
    // In this context, removal of messages cannot be leveraged to Lambda,
    // thus actions have to be taken to remove messages

    const queueActions: Promise<void>[] = [];

    for (let i = 0; i < messages.length; ++i) {
      const message = messages[i];
      const result = settledRequests[i];

      if (result.status === 'fulfilled') {
        if (result.value)
          queueActions.push(message.remove());
        else
          queueActions.push(message.delay());
      }
    }

    const settledQueueActions = await Promise.allSettled(queueActions);

    const numberOfFailedActions = getNumberOfRejections(settledQueueActions);

    let errorMessage = '';

    if (numberOfInvalidMessages)
      errorMessage += numberOfInvalidMessages + ' messages are invalid.\n';

    if (numberOfFailedRequests)
      errorMessage += numberOfFailedRequests + ' requests have failed\n';

    if (numberOfFailedActions)
      errorMessage += numberOfFailedActions + ' queue actions have failed\n';

    throw new Error(errorMessage);
  }
};


const getNumberOfRejections = (promises: PromiseSettledResult<unknown>[]): number =>
  promises.reduce(((n, result) => result.status === 'rejected' ? n + 1 : n), 0);
