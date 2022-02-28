import * as assert from 'assert';

import DynamoDB from '~seams/dynamodb';


type UInt16Pair = [number, number];


export const decodeUInt8 = ({ B: value }: DynamoDB.AttributeValue): number => {
  assert(value instanceof Buffer);
  assert(value.length === 1);

  return value.readUInt8(0);
};

export const encodeUInt8 = (value: number): DynamoDB.AttributeValue => {
  const buffer = Buffer.allocUnsafe(1);

  buffer.writeUInt8(value, 0);

  return { B: buffer };
};


export const decodeUInt16 = ({ B: value }: DynamoDB.AttributeValue): number => {
  assert(value instanceof Buffer);
  assert(value.length === 2);

  return value.readUInt16BE(0);
};

export const encodeUInt16 = (value: number): DynamoDB.AttributeValue => {
  const buffer = Buffer.allocUnsafe(2);

  buffer.writeUInt16BE(value, 0);

  return { B: buffer };
};


export const decodeUInt32 = ({ B: value }: DynamoDB.AttributeValue): number => {
  assert(value instanceof Buffer);
  assert(value.length === 4);

  return value.readUInt32BE(0);
};

export const encodeUInt32 = (value: number): DynamoDB.AttributeValue => {
  const buffer = Buffer.allocUnsafe(4);

  buffer.writeUInt32BE(value, 0);

  return { B: buffer };
};


export const decodeBinary =
({ B: value }: DynamoDB.AttributeValue, length?: number): Buffer => {
  assert(value instanceof Buffer);
  length ?? assert(value.length === length);

  return value;
};

export const encodeBinary = (value: Buffer): DynamoDB.AttributeValue =>
  ({ B: value });


export const decodeString = ({ S: value }: DynamoDB.AttributeValue): string => {
  assert(typeof value === 'string');

  return value;
};

export const encodeString = (value: string): DynamoDB.AttributeValue => ({ S: value });


export const decodeNumber = ({ N: value }: DynamoDB.AttributeValue): number => {
  assert(typeof value === 'string');

  const numberValue = Number(value);

  assert(!Number.isNaN(numberValue));

  return numberValue;
};

export const encodeNumber = (value: number): DynamoDB.AttributeValue =>
  ({ N: String(value) });


export const decodeDate = ({ B: value }: DynamoDB.AttributeValue): Date => {
  assert(value instanceof Buffer);
  assert(value.length === 8);

  return new Date(Number(value.readBigUInt64BE(0)));
};

export const encodeDate = (value: Date): DynamoDB.AttributeValue => {
  const buffer = Buffer.allocUnsafe(8);

  buffer.writeBigInt64BE(BigInt(value.getTime()), 0);

  return { B: buffer };
};


export const decodeStringSet = ({ SS: value }: DynamoDB.AttributeValue): string[] => {
  assert(value instanceof Array);

  return value;
};

export const encodeStringSet = (value: string[]): DynamoDB.AttributeValue =>
  ({ SS: value });


export const decodeBinarySet = ({ BS: value }: DynamoDB.AttributeValue): Buffer[] => {
  assert(value instanceof Array);

  return value as Buffer[];
};

export const encodeBinarySet = (value: Buffer[]): DynamoDB.AttributeValue =>
  ({ BS: value });


export const decodeUInt16PairSet = ({ BS: value }: DynamoDB.AttributeValue)
: UInt16Pair[] => {

  assert(value instanceof Array);

  return (<Buffer[]>value).map(_decodeUInt16Pair);
};

export const encodeUInt16PairSet = (value: UInt16Pair[]): DynamoDB.AttributeValue =>
  encodeBinarySet(value.map(_encodeUInt16Pair));


export const decodeMap = ({ M: value }: DynamoDB.AttributeValue)
: DynamoDB.MapAttributeValue => {

  assert(typeof value === 'object');

  return value;
};

export const encodeMap = (value: DynamoDB.MapAttributeValue): DynamoDB.AttributeValue =>
  ({ M: value });


const _decodeUInt16Pair = (value: Buffer): UInt16Pair => {
  assert(value.length === 4);

  return [value.readUInt16BE(0), value.readUInt16BE(2)];
};

export const decodeUInt16Pair = ({ B: value }: DynamoDB.AttributeValue): UInt16Pair => {
  assert(value instanceof Buffer);

  return _decodeUInt16Pair(value);
};


const _encodeUInt16Pair = (value: UInt16Pair) => {
  const buffer = Buffer.allocUnsafe(4);

  buffer.writeUInt16BE(value[0], 0);
  buffer.writeUInt16BE(value[1], 2);

  return buffer;
};

export const encodeUInt16Pair = (value: UInt16Pair): DynamoDB.AttributeValue =>
  ({ B: _encodeUInt16Pair(value) });
