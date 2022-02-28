import * as imageResource from '../resources/image';


export interface Image {
  imageId: string;
  order: number;
  formats: string[];
  thumbnail: ImageAspect;
  sizes: ImageAspect[];
}

export interface ImageWithTags extends Image {
  tags: string[];
}

export interface ImageAspect {
  partialKey: string;
  width: number;
  height: number;
}


export const createImage = (image: imageResource.IndexedImage, prefix = '')
: Image => {
  const baseKey = prefix + image.imageId;

  return {
    imageId  : image.imageId,
    order    : image.order,
    formats  : image.formats,
    thumbnail: {
      partialKey: imageResource.makeThumbnailPartialKey(baseKey),
      width     : image.thumbnail[0],
      height    : image.thumbnail[1],
    },
    sizes: image.sizes.map(([width, height]) =>
      ({
        partialKey: imageResource.makeStandardPartialKey(baseKey, width, height),
        width,
        height,
      })),
  };
};


export const createImageWithTags = (image: imageResource.TransformedImage, prefix = '')
: ImageWithTags => ({
  ...createImage(image, prefix),
  tags: image.tags,
});
