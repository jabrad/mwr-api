import sharp from '~seams/sharp';
import * as stream from 'stream';
import * as assert from 'assert';


export type BoundRawImgTransform<T> = (rawImgSpec: RawImgSpec) => T;

export type RawImgChannels = 1 | 2 | 3 | 4;

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6;
export interface RawImgSpec {
  width: number;
  height: number;
  channels: RawImgChannels;
}

export interface Metadata extends RawImgSpec {
  size: number;
  format: string;
  orientation?: ExifOrientation;
}

export interface RawImgReadable {
  stream: stream.Readable;
  rawImgSpec: RawImgSpec;
}

export interface RawImgDuplex extends RawImgReadable {
  stream: stream.Duplex;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface ImageSizeAndType extends Dimensions {
  type: string;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Starting at the first point - clockwise if y-axis is inverted;
 * counterclockwise otherwise.
 */
type Rectangle = [Point, Point, Point, Point];

export interface CropOpts {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface AngularCropOpts extends CropOpts {
  angle: number;
}

export interface ThumbnailOpts extends Partial<Dimensions> {
  crop?: CropOpts;
}

export interface AngularCropOffset {
  top: number;
  left: number;
}


export class InvalidOpts extends Error {}


export const assertRawImgSpec = (spec: RawImgSpec): void | never => {
  if (spec.channels < 1 || spec.channels > 4)
    throw new InvalidOpts(`Channel is not in [1,4] range`);

  assertDimensions(spec);
};


export const assertDimensions = (dimensions: Dimensions): void | never => {
  if (dimensions.width < 0)
    throw new InvalidOpts(`Width is negative`);

  if (dimensions.height < 0)
    throw new InvalidOpts(`Height is negative`);
};


export const assertAnyOfDimensions = (opts: Partial<Dimensions>): void | never => {
  if ((opts.width ?? opts.height) === undefined)
    throw new InvalidOpts(`Neither dimension is specified`);

  assertDimensions({
    width : opts.width ?? 0,
    height: opts.height ?? 0,
  });
};


export const assertCropOpts = (opts: CropOpts): void | never => {
  if (opts.top < 0)
    throw new InvalidOpts(`Top anchor offfset is negative`);

  if (opts.left < 0)
    throw new InvalidOpts(`Left anchor offfset is negative`);

  assertDimensions(opts);
};


export const assertAngularCropOpts = (opts: AngularCropOpts): void | never => {
  assertCropOpts(opts);
};


export const assertParallelCropArea =
  (opts: CropOpts, dimensions: Dimensions): void | never => {
    if (
      opts.top + opts.height > dimensions.height ||
      opts.left + opts.width > dimensions.width
    )
      throw new InvalidOpts('Crop area is not contained within the provided image');
  };


export const assertRotatedCropArea =
  (opts: AngularCropOpts, dimensions: Dimensions): void | never => {
    // Crop area, defined by 4 (x, y) points, after rotation
    const cropArea = rotateRectangle(opts, rad(opts.angle));

    // Assert crop area after adjusting it by top-left offset
    for (const point of cropArea) {
      const x = point.x + opts.left;
      const y = point.y + opts.top;

      // NOTE: because an (x, y) point is defined in the cartesian coordinate system,
      // with "first" pixel at (0, 0), we use >= instead of >.
      // It is equivalent to for example x > (dimensions.width - 1).
      if (x < 0 || x >= dimensions.width || y < 0 || y >= dimensions.height)
        throw new InvalidOpts(`Crop area is not contained within the provided image`);
    }
  };


export const assertThumbnailOpts = (opts: ThumbnailOpts): void | never => {
  assertAnyOfDimensions(opts);

  if (opts.crop)
    assertCropOpts(opts.crop);
};


export const scaleWidth =
  (height: number, refWidth: number, refHeight: number): number =>
    Math.round((height * refWidth) / refHeight);


export const scaleHeight =
  (width: number, refWidth: number, refHeight: number): number =>
    Math.round((width * refHeight) / refWidth);


export const resizeDimensions =
  (dimensions: Dimensions, newSize: Partial<Dimensions>): Dimensions => {
    assertDimensions(dimensions);
    assertAnyOfDimensions(newSize);

    // At this point either opts.width or opts.height is specified,
    // thus the following non-null assertion warning is a false positive.
    const width =
      newSize.width || scaleWidth(newSize.height!, dimensions.width, dimensions.height);
    const height =
      newSize.height || scaleHeight(newSize.width!, dimensions.width, dimensions.height);

    return { width, height };
  };


export const rad = (degrees: number): number => (degrees / 180) * Math.PI;


export const deg = (radians: number): number => (radians * 180) / Math.PI;


export const roundCoordinates = (point: Point): Point => ({
  x: Math.round(point.x),
  y: Math.round(point.y),
});


export const rotateRectangleVertex = (vertex: Point, angle: number): Point =>
  roundCoordinates({
    x: vertex.x * Math.cos(angle) - vertex.y * Math.sin(angle),
    y: vertex.x * Math.sin(angle) + vertex.y * Math.cos(angle),
  });


export const rotateRectangle =
  (dimensions: Dimensions, angle: number): Rectangle => {
    // EXAMPLE: with angle ~20[deg]
    //       |
    //       |
    // ------*------>
    //      *|     *
    //       |    *
    //       v

    assertDimensions(dimensions);

    const x = dimensions.width - 1;
    const y = dimensions.height - 1;

    return [
      { x: 0, y: 0 },
      rotateRectangleVertex({ x, y: 0 }, angle),
      rotateRectangleVertex({ x, y }, angle),
      rotateRectangleVertex({ x: 0, y }, angle),
    ];
  };


export const getAngularCropOffset =
  (offset: AngularCropOffset, angle: number, dimensions: Dimensions)
  : AngularCropOffset => {
    // Normalize the angle into the <0, 360)[deg] range.
    const normalizedAngle = ((angle % 360) + 360) % 360;

    const maxTopOffset = dimensions.height - 1;
    const maxLeftOffset = dimensions.width - 1;

    const sinAlpha = Math.sin(rad(normalizedAngle));
    const cosAlpha = Math.cos(rad(normalizedAngle));

    let top: number;
    let left: number;

    const x = offset.left * cosAlpha - offset.top * sinAlpha;
    const y = offset.left * sinAlpha + offset.top * cosAlpha;

    if (normalizedAngle <= 90) { // I quadrant
      top = y;
      left = maxTopOffset * sinAlpha + x;
    }
    else if (normalizedAngle <= 180) { // II quadrant
      top = -maxTopOffset * cosAlpha + y;
      left = -maxLeftOffset * cosAlpha + maxTopOffset * sinAlpha + x;
    }
    else if (normalizedAngle <= 270) { // III quadrant
      top = -maxLeftOffset * sinAlpha - maxTopOffset * cosAlpha + y;
      left = -maxLeftOffset * cosAlpha + x;
    }
    else { // IV quadrant
      top = -maxLeftOffset * sinAlpha + y;
      left = x;
    }

    top = Math.round(top);
    left = Math.round(left);

    return { top, left };
  };


export const getMetadata = async (img: Buffer): Promise<Metadata> => {
  const metadata = await sharp(img).metadata();

  assert(metadata.width !== undefined);
  assert(metadata.height !== undefined);
  assert(metadata.channels !== undefined);
  assert(metadata.size !== undefined);
  assert(metadata.format !== undefined);

  return {
    width      : metadata.width,
    height     : metadata.height,
    channels   : metadata.channels,
    size       : metadata.size,
    format     : metadata.format,
    orientation: metadata.orientation as (ExifOrientation | undefined),
  };
};


export const decompressStreamToRGB = (dimensions: Dimensions): RawImgDuplex => {
  assertDimensions(dimensions);

  const transform = sharp().removeAlpha().raw();

  const outRawImgSpec: RawImgSpec = {
    width   : dimensions.width,
    height  : dimensions.height,
    channels: 3,
  };

  return { stream: transform, rawImgSpec: outRawImgSpec };
};


export const toRaw = (img: Buffer, meta: Metadata): RawImgDuplex => {
  const outRawImgSpec: RawImgSpec = {
    width   : meta.width,
    height  : meta.height,
    channels: meta.channels,
  };

  let transform: sharp.Sharp;

  // https://github.com/lovell/sharp/issues/1578
  const sharpOpts = { failOnError: false };

  if (!meta.orientation || meta.orientation === 1) {
    transform = sharp(img, sharpOpts)
      .raw();
  }
  else {
    transform = sharp(img, sharpOpts)
      .rotate()
      .raw();

    if (meta.orientation > 4) {
      outRawImgSpec.width = meta.height;
      outRawImgSpec.height = meta.width;
    }
  }

  return { stream: transform, rawImgSpec: outRawImgSpec };
};


/**
 * Creates a duplex stream compressing piped image data into the given format.
 *
 * @param format Format to be used.
 * @param rawImgSpec RawImg specification. Required when piped image data is a rawImg.
 * @returns Duplex stream formatting piped image data into the given format.
 */
export const format =
  (format: 'jpeg' | 'webp', rawImgSpec: RawImgSpec): stream.Duplex => {
    if (rawImgSpec)
      assertRawImgSpec(rawImgSpec);

    return sharp({ raw: rawImgSpec })
      .toFormat(format);
  };


export const resize =
  (size: Partial<Dimensions>, srcRawImgSpec: RawImgSpec): RawImgDuplex => {
    assertAnyOfDimensions(size);
    assertRawImgSpec(srcRawImgSpec);

    const resizedDimensions = resizeDimensions(srcRawImgSpec, size);

    const transform = sharp({ raw: srcRawImgSpec })
      .resize(resizedDimensions)
      .raw();

    const outRawImgSpec: RawImgSpec = {
      ...resizedDimensions,
      channels: srcRawImgSpec.channels,
    };

    return { stream: transform, rawImgSpec: outRawImgSpec };
  };


export const crop = (opts: CropOpts, srcRawImgSpec: RawImgSpec): RawImgDuplex => {
  assertCropOpts(opts);
  assertRawImgSpec(srcRawImgSpec);
  assertParallelCropArea(opts, srcRawImgSpec);

  const transform = sharp({ raw: srcRawImgSpec })
    .extract(opts)
    .raw();

  const outRawImgSpec: RawImgSpec = {
    width   : opts.width,
    height  : opts.height,
    channels: srcRawImgSpec.channels,
  };

  return { stream: transform, rawImgSpec: outRawImgSpec };
};


/**
 * Transforms an image with respect to provided parameters.
 *
 * @param imgData Image data.
 * @param srcRawImgSpec RawImg specification. Required when given image data is a rawImg.
 * @returns RawImg and its specification.
 */
export const angularCrop =
  (opts: AngularCropOpts, srcRawImgSpec: RawImgSpec): RawImgDuplex => {
    assertAngularCropOpts(opts);
    assertRawImgSpec(srcRawImgSpec);
    assertRotatedCropArea(opts, srcRawImgSpec);

    const cropOffset = getAngularCropOffset(opts, -opts.angle, srcRawImgSpec);

    const transform = sharp({ raw: srcRawImgSpec })
      .rotate(-opts.angle)
      .extract({
        ...cropOffset,
        width : opts.width,
        height: opts.height,
      })
      .raw();

    const outRawImgSpec: RawImgSpec = {
      width   : opts.width,
      height  : opts.height,
      channels: srcRawImgSpec.channels,
    };

    return { stream: transform, rawImgSpec: outRawImgSpec };
  };


/**
 * Creates a duplex stream used to create a thumbnail.
 *
 * Resulting thumbnail is of given width and scaled height.
 *
 * @param width Width of resulting thumbnail.
 * @param srcRawImgSpec RawImg specification. Required when piped image data is a rawImg.
 * @returns Duplex stream, transforming piped image data into
 * a rawImg formatted thumbnail, and a corresponding rawImg specification.
 */
export const thumbnail =
  (opts: ThumbnailOpts, srcRawImgSpec: RawImgSpec): RawImgDuplex => {
    assertThumbnailOpts(opts);
    assertRawImgSpec(srcRawImgSpec);

    const resizedDimensions = resizeDimensions(srcRawImgSpec, opts);

    const transform = sharp({ raw: srcRawImgSpec });

    if (opts.crop) {
      assertParallelCropArea(opts.crop, srcRawImgSpec);

      transform.extract(opts.crop);
    }

    transform.resize(resizedDimensions);
    transform.raw();

    const outRawImgSpec: RawImgSpec = {
      ...resizedDimensions,
      channels: srcRawImgSpec.channels,
    };

    return { stream: transform, rawImgSpec: outRawImgSpec };
  };


export const pipeline = <
  T extends BoundRawImgTransform<RawImgDuplex>[],
  U extends BoundRawImgTransform<stream.Duplex> | BoundRawImgTransform<RawImgDuplex>
>(
  readable: RawImgReadable, ...duplex: [...T, U]
): ReturnType<U> => {

  let prevStream: RawImgReadable = readable;

  for (const stream of duplex) {
    const aux = stream(prevStream.rawImgSpec);

    if ('stream' in aux) {
      prevStream.stream.pipe(aux.stream);
    }
    else {
      prevStream.stream.pipe(aux);

      return aux as ReturnType<U>;
    }

    prevStream = aux;
  }

  return prevStream as ReturnType<U>;
};
