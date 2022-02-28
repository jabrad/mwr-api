import * as tableOne from 'lib/external/tables/table_one';
import config from 'lib/config';
import * as serviceErrors from 'lib/service/errors';
import * as tagsRepresentation from 'lib/service/representations/tags';


export const getTags = async (): Promise<tagsRepresentation.Tags> => {
  const tableOneClient = new tableOne.TableOne(config.tableName, config.basicAWSConfig);

  try {
    const countedTags = await tableOneClient.getTags();

    const tags = Object.entries(countedTags)
      .filter(([_, count]) => count > 0)
      .map(([name]) => name);

    return tags;
  }
  catch (err) {
    console.error(err);

    const errMessage = 'Failed to retrieve tags from the database';

    if (tableOne.isExternalFailure(err))
      throw new serviceErrors.ExternalServerError(errMessage);

    throw new serviceErrors.InternalError(errMessage);
  }
};
