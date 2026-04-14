import { ContentfulStatusCode } from "hono/utils/http-status";

class CustomError extends Error {
  status: ContentfulStatusCode;
  data: unknown;

  constructor(message: string, status: ContentfulStatusCode, data?: unknown) {
    super(message);
    this.name = "CustomError";
    this.status = status;
    this.data = data;
  }
}

export default CustomError;
