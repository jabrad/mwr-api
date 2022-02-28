export class ServiceError {
  constructor(
    public code: string,
    public statusCode: number,
    public message?: string,
  ) {}
}


export class UnspecifiedId extends ServiceError {
  constructor() {
    super('UNSPECIFIED_ID', 400);
  }
}

export class OptsParsingError extends ServiceError {
  constructor() {
    super('OPTS_PARSING_ERROR', 400);
  }
}

export class InvalidOpts extends ServiceError {
  constructor(message: string) {
    super('INVALID_OPTS', 400, message);
  }
}

export class ExternalServerError extends ServiceError {
  constructor(message?: string) {
    super('EXTERNAL_SERVER_ERROR', 503, message);
  }
}

export class InternalError extends ServiceError {
  constructor(message?: string) {
    super('INTERNAL_ERROR', 500, message);
  }
}
