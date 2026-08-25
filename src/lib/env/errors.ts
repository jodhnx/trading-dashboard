export class EnvValidationError extends Error {
  readonly code = "ENV_VALIDATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "EnvValidationError";
  }
}
