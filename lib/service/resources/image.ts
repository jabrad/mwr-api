import * as crypto from 'crypto';


export type Dimensions = [width: number, height: number];

export interface BaseImage {
  imageId: string;
  uploadDate: Date;
  width: number;
  height: number;
  size: number;
  filename: string;
  format: string;
  transform: string;
}

export interface IndexedImage {
  imageId: string;
  order: number;
  thumbnail: Dimensions;
  sizes: Dimensions[];
  formats: string[];
}

export interface TransformedImage extends IndexedImage {
  tags: string[];
}


export const idPattern = /^[0-9a-fA-F]{32}$/;


export const generateId = (): string =>
  crypto.randomBytes(16).toString('hex');


export const testId = (id: string): boolean =>
  idPattern.test(id);


export const makeThumbnailPartialKey = (baseKey: string): string =>
  baseKey + '.thu';


export const makeStandardPartialKey = (baseKey: string, width: number, height: number)
: string =>
  baseKey + `.${width}-${height}`;


export const makeFullKey = (partialKey: string, format: string): string =>
  partialKey + '.' + format;
