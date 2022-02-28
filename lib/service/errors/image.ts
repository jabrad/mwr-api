import { ServiceError } from './common';


export class NoSuchImage extends ServiceError {
  constructor(message: string) {
    super('NO_SUCH_IMAGE', 404, message);
  }
}

export class UnsupportedImageFormat extends ServiceError {
  constructor() {
    super('UNSUPPORTED_IMAGE_FORMAT', 400);
  }
}

export class CorruptedImageFile extends ServiceError {
  constructor() {
    super('CORRUPTED_IMAGE_FILE', 400);
  }
}
