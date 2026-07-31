export class BuyerOrderParseError extends Error {
  readonly code = "MALFORMED_RESPONSE";

  constructor() {
    super("MALFORMED_RESPONSE");
    this.name = "BuyerOrderParseError";
  }
}
