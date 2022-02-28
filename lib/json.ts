// eslint-disable-next-line @typescript-eslint/ban-types
const hasOwnProperty = <T extends {}, U extends PropertyKey> (obj: T, prop: U)
: obj is T & Record<U, unknown> =>
  Object.prototype.hasOwnProperty.call(obj, prop);


export const decodeBufferBase64 = (_key: string, value: unknown): unknown => {
  if (
    typeof value === 'object'
    && value
    && hasOwnProperty(value, 'type')
    && typeof value.type === 'string'
    && value.type === 'Base64Buffer'
    && hasOwnProperty(value, 'data')
    && typeof value.data === 'string'
  )
    return Buffer.from(value.data, 'base64');

  return value;
};


export const encodeBufferBase64 = (_key: string, value: unknown): unknown => {
  if (
    typeof value === 'object'
    && value
    && hasOwnProperty(value, 'type')
    && typeof value.type === 'string'
    && value.type === 'Buffer'
    && hasOwnProperty(value, 'data')
    && value.data instanceof Array
  ) {
    return {
      type: 'Base64Buffer',
      data: Buffer.from(value.data).toString('base64'),
    };
  }

  return value;
};
