/**
 * CORS headers for API responses
 */
export const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': true,
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'
};

/**
 * Create a successful response
 * @param {number} statusCode - The HTTP status code
 * @param {Object} body - The response body
 * @returns {Object} The formatted response
 */
export function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

/**
 * Create a success response (200 OK)
 * @param {Object} data - The response data
 * @returns {Object} The formatted response
 */
export function createSuccessResponse(data) {
  return createResponse(200, data);
}

/**
 * Create a created response (201 Created)
 * @param {Object} data - The created resource
 * @returns {Object} The formatted response
 */
export function createCreatedResponse(data) {
  return createResponse(201, data);
}

/**
 * Create a no content response (204 No Content)
 * @param {string} [message] - Optional message
 * @returns {Object} The formatted response
 */
export function createNoContentResponse(message = 'Operation completed successfully') {
  return createResponse(204, { message });
}

/**
 * Create a not found response (404 Not Found)
 * @param {string} [message] - Optional message
 * @returns {Object} The formatted response
 */
export function createNotFoundResponse(message = 'Resource not found') {
  return createResponse(404, { message });
}

/**
 * Create an error response (500 Internal Server Error)
 * @param {Error} error - The error
 * @returns {Object} The formatted response
 */
export function createErrorResponse(error) {
  console.error('Error:', error);
  return createResponse(500, { 
    message: 'Internal Server Error', 
    error: error.message 
  });
}

/**
 * Handle OPTIONS requests for CORS preflight
 * @returns {Object} The CORS preflight response
 */
export function handleOptionsRequest() {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: ''
  };
}

/**
 * Parse the request path to extract resource and ID
 * @param {string} path - The request path
 * @returns {Object} The parsed path with resource and resourceId
 */
export function parsePath(path) {
  const pathSegments = path.split('/');
  return {
    resource: pathSegments[1], // 'categories', 'templates', or 'variables'
    resourceId: pathSegments[2], // categoryId, templateId, or undefined
    subResource: pathSegments[3] // 'default' or undefined
  };
}

/**
 * Parse the request body
 * @param {string} body - The request body as a string
 * @returns {Object} The parsed body as an object
 */
export function parseBody(body) {
  return body ? JSON.parse(body) : {};
}

/**
 * Add timestamps to an object
 * @param {Object} obj - The object to add timestamps to
 * @param {boolean} [isNew=false] - Whether this is a new object (adds createdAt)
 * @returns {Object} The object with timestamps
 */
export function addTimestamps(obj, isNew = false) {
  const now = new Date().toISOString();
  const result = { ...obj, updatedAt: now };
  
  if (isNew) {
    result.createdAt = now;
  }
  
  return result;
}