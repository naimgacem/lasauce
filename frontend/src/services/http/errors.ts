import { ApiError, type ErrorEnvelope } from "@/types/api";

/** Map a non-OK Response to a normalised ApiError (backend envelope aware). */
export async function parseErrorResponse(res: Response): Promise<ApiError> {
  let envelope: Partial<ErrorEnvelope> | undefined;
  try {
    envelope = (await res.json()) as Partial<ErrorEnvelope>;
  } catch {
    // non-JSON body — fall through to generic mapping
  }

  if (envelope?.error?.message) {
    return new ApiError({
      message: envelope.error.message,
      code: envelope.error.code,
      status: res.status,
      details: envelope.error.details,
    });
  }
  return new ApiError({
    message: res.statusText || `Request failed (${res.status})`,
    code: "HTTP_ERROR",
    status: res.status,
  });
}

export const networkError = () =>
  new ApiError({
    message: "Cannot reach the server. Check your connection and try again.",
    code: "NETWORK_ERROR",
    status: 0,
  });
