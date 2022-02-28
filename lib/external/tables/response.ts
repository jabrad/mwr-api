import type { AWSError } from 'aws-sdk';


const commonRetryableErrors = new Set([
  'InternalServerError',
  'InternalFailure',
  'ServiceUnavailable',
  'ThrottlingException',
  'ProvisionedThroughputExceededException',
  'RequestLimitExceeded',
].map(str => str.toLowerCase()));

const retryableSingleWriteErrors = new Set([
  ...commonRetryableErrors,
  'TransactionConflictException'.toLowerCase(),
]);

const retryableTransactionCancelationReasons = new Set([
  'NONE',
  'TransactionConflict',
  'ProvisionedThroughputExceeded',
  'ThrottlingError',
].map(str => str.toLowerCase()));


export const isCanceledTransactionRetryable = (errMessage: string): boolean => {
  const reasonsRaw = errMessage.match(/\[(.*)\]$/);

  if (reasonsRaw) {
    return reasonsRaw[1] // first capture group
      .split(',')
      .map(reason => reason.trim().toLowerCase())
      .every(reason => retryableTransactionCancelationReasons.has(reason));
  }
  else {
    // Unknown message format
    return false;
  }
};


export const isTransactionRetryable = (err: AWSError): boolean =>
  commonRetryableErrors.has(err.code.toLowerCase())
  || err.code.toLowerCase() === 'TransactionCanceledException'.toLowerCase()
    && isCanceledTransactionRetryable(err.message);


export const isSingleWriteRetryable = (err: AWSError): boolean =>
  retryableSingleWriteErrors.has(err.code.toLowerCase());
