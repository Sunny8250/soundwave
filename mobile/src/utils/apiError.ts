/**
 * Custom API Error with specific error codes
 * Allows mobile to show contextual error messages
 */

export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = "NETWORK_ERROR",
  TIMEOUT = "TIMEOUT",
  OFFLINE = "OFFLINE",

  // Auth errors
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  SESSION_EXPIRED = "SESSION_EXPIRED",

  // Validation errors
  INVALID_INPUT = "INVALID_INPUT",
  VALIDATION_ERROR = "VALIDATION_ERROR",

  // Resource errors
  NOT_FOUND = "NOT_FOUND",
  RESOURCE_IN_USE = "RESOURCE_IN_USE",
  DUPLICATE = "DUPLICATE",

  // Permission errors
  PERMISSION_DENIED = "PERMISSION_DENIED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",

  // Track specific
  TRACK_IN_USE = "TRACK_IN_USE",
  TRACK_PROTECTED = "TRACK_PROTECTED",
  INVALID_TRACK = "INVALID_TRACK",

  // Album specific
  ALBUM_IN_USE = "ALBUM_IN_USE",
  INVALID_ALBUM = "INVALID_ALBUM",

  // Artist specific
  ARTIST_IN_USE = "ARTIST_IN_USE",
  INVALID_ARTIST = "INVALID_ARTIST",

  // Server errors
  SERVER_ERROR = "SERVER_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // Generic
  UNKNOWN = "UNKNOWN",
}

export class APIError extends Error {
  code: ErrorCode;
  status?: number;
  originalError?: Error;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    status?: number,
    originalError?: Error,
  ) {
    super(message);
    this.name = "APIError";
    this.code = code;
    this.status = status;
    this.originalError = originalError;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, APIError.prototype);
  }

  /**
   * User-friendly error messages
   */
  getDisplayMessage(): string {
    switch (this.code) {
      case ErrorCode.OFFLINE:
        return "You are offline. This action has been queued and will sync when online.";
      case ErrorCode.NETWORK_ERROR:
        return "Network error. Please check your connection and try again.";
      case ErrorCode.TIMEOUT:
        return "Request timed out. Please try again.";
      case ErrorCode.UNAUTHORIZED:
        return "Authentication failed. Please log in again.";
      case ErrorCode.FORBIDDEN:
      case ErrorCode.PERMISSION_DENIED:
        return "You don't have permission to perform this action.";
      case ErrorCode.TRACK_IN_USE:
        return "This track is in use and cannot be deleted.";
      case ErrorCode.TRACK_PROTECTED:
        return "This track is protected and cannot be modified.";
      case ErrorCode.ALBUM_IN_USE:
        return "This album has tracks and cannot be deleted.";
      case ErrorCode.ARTIST_IN_USE:
        return "This artist has tracks and cannot be deleted.";
      case ErrorCode.NOT_FOUND:
        return "Resource not found.";
      case ErrorCode.INVALID_INPUT:
      case ErrorCode.VALIDATION_ERROR:
        return this.message || "Invalid input. Please check your data.";
      case ErrorCode.SERVER_ERROR:
      case ErrorCode.SERVICE_UNAVAILABLE:
        return "Server error. Please try again later.";
      default:
        return this.message || "An error occurred. Please try again.";
    }
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    return [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT,
      ErrorCode.SERVER_ERROR,
      ErrorCode.SERVICE_UNAVAILABLE,
    ].includes(this.code);
  }

  /**
   * Check if this error is due to offline mode
   */
  isOffline(): boolean {
    return this.code === ErrorCode.OFFLINE;
  }
}

/**
 * Parse error response from API and return APIError
 */
export function parseAPIError(
  error: any,
  defaultMessage = "An error occurred",
): APIError {
  // Handle network timeouts
  if (error instanceof Error && error.message.includes("timeout")) {
    return new APIError(
      "Request timed out",
      ErrorCode.TIMEOUT,
      undefined,
      error,
    );
  }

  // Handle fetch errors (no network)
  if (error instanceof TypeError && error.message.includes("Network")) {
    return new APIError(
      "Network error",
      ErrorCode.NETWORK_ERROR,
      undefined,
      error,
    );
  }

  // Handle HTTP errors from API
  if (error instanceof Error) {
    const msg = error.message || "";

    // Check for specific error codes from backend
    if (msg.includes("TRACK_IN_USE"))
      return new APIError(
        "Track is in use",
        ErrorCode.TRACK_IN_USE,
        undefined,
        error,
      );
    if (msg.includes("ALBUM_IN_USE"))
      return new APIError(
        "Album is in use",
        ErrorCode.ALBUM_IN_USE,
        undefined,
        error,
      );
    if (msg.includes("ARTIST_IN_USE"))
      return new APIError(
        "Artist is in use",
        ErrorCode.ARTIST_IN_USE,
        undefined,
        error,
      );
    if (msg.includes("PERMISSION_DENIED"))
      return new APIError(
        "Permission denied",
        ErrorCode.PERMISSION_DENIED,
        undefined,
        error,
      );
    if (msg.includes("INVALID_INPUT"))
      return new APIError(
        "Invalid input",
        ErrorCode.INVALID_INPUT,
        undefined,
        error,
      );

    // Check for HTTP status codes
    if (msg.includes("401") || msg.includes("Unauthorized"))
      return new APIError("Unauthorized", ErrorCode.UNAUTHORIZED, 401, error);
    if (msg.includes("403") || msg.includes("Forbidden"))
      return new APIError("Forbidden", ErrorCode.FORBIDDEN, 403, error);
    if (msg.includes("404") || msg.includes("Not Found"))
      return new APIError("Not found", ErrorCode.NOT_FOUND, 404, error);
    if (msg.includes("500") || msg.includes("Internal Server"))
      return new APIError("Server error", ErrorCode.SERVER_ERROR, 500, error);
    if (msg.includes("503") || msg.includes("Service Unavailable"))
      return new APIError(
        "Service unavailable",
        ErrorCode.SERVICE_UNAVAILABLE,
        503,
        error,
      );

    return new APIError(
      msg || defaultMessage,
      ErrorCode.UNKNOWN,
      undefined,
      error,
    );
  }

  return new APIError(defaultMessage, ErrorCode.UNKNOWN, undefined, error);
}
