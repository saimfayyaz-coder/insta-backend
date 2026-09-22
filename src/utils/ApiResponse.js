class ApiResponse {
  constructor(success, message, data = null, errors = null, code = null) {
    this.success = success;
    this.message = message; // English description (for logs/debugging)
    this.data = data;
    this.errors = errors;   // Field-specific: { email: ["..."] }
    this.code = code;       // Structured identifier e.g. 'INVALID_CREDENTIALS'
  }
}

export default ApiResponse;
