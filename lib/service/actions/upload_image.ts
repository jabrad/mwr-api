import * as imageResource from 'lib/service/resources/image';
import config from 'lib/config';
import * as storage from 'lib/external/storage';


export interface UploadImageResult {
  imageId: string;
  post: storage.PresignedPost;
}


export const generateImagePost = (): UploadImageResult => {
  const imageId = imageResource.generateId();

  console.log('Upload id:', imageId);

  const storageClient = new storage.Storage(config.bucketName, config.basicAWSConfig);

  return {
    imageId,
    post: storageClient.createImagePost(
      config.uploadsStorePrefix + imageId, config.uploadImageExpires),
  };
};
