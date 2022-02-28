import * as ajv from 'ajv';
import * as serviceErrors from 'lib/service/errors';
import * as imageResource from 'lib/service/resources/image';
import * as tagsResource from 'lib/service/resources/tags';
import { URLSearchParams } from 'url';


export type QueryParams = {[param: string]: string};


export const validateImageId = (id: string): string => {
  if (!imageResource.testId(id))
    throw new serviceErrors.InvalidOpts('Invalid id');

  return id;
};


export const validateTag = (tag: string): string => {
  if (!tagsResource.testTag(tag))
    throw new serviceErrors.InvalidOpts('Invalid tag');

  return tag;
};


export const createSchemaValidator = <T>(validator: ajv.ValidateFunction<T>)
: (data: unknown) => T => (data) => {
  if (!validator(data))
    throw new serviceErrors.InvalidOpts(JSON.stringify(validator.errors));
  else
    return data;
};


export const parseJson = (opts: string): unknown => {
  try {
    return JSON.parse(opts);
  }
  catch (err) {
    throw new serviceErrors.OptsParsingError();
  }
};


export const parseQuery = (queryString: string): QueryParams =>
  Object.fromEntries(new URLSearchParams(queryString).entries());
