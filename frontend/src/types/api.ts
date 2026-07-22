/** Backend error envelope: `{ error: { code, message, details } }`. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Paginated list response (matches the implemented backend). */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/** Normalised application error thrown by the http layer. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(params: {
    message: string;
    code?: string;
    status?: number;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.code = params.code ?? "UNKNOWN";
    this.status = params.status ?? 0;
    this.details = params.details;
  }
}
