import { createDynamoDBClient } from './db.mjs';
import { handleOptionsRequest, parsePath, parseBody, createErrorResponse, createResponse } from './utils.mjs';
import * as categoryService from './categoryService.mjs';
import * as templateService from './templateService.mjs';
import * as variableService from './variableService.mjs';

/**
 * Main handler for Templates Lambda function
 * @param {Object} event - The Lambda event
 * @returns {Promise<Object>} The API response
 */
export const handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  // Handle OPTIONS method for CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return handleOptionsRequest();
  }

  try {
    // Create DynamoDB client
    const dynamodb = createDynamoDBClient();

    // Parse path and body
    const { resource, resourceId, subResource } = parsePath(event.path);
    const requestBody = parseBody(event.body);

    // Route to appropriate handler based on HTTP method and path
    return await routeRequest(event.httpMethod, resource, resourceId, subResource, requestBody, dynamodb, event.queryStringParameters);
  } catch (error) {
    return createErrorResponse(error);
  }
};

/**
 * Route the request to the appropriate handler
 * @param {string} httpMethod - The HTTP method
 * @param {string} resource - The resource (categories, templates, variables)
 * @param {string} resourceId - The resource ID
 * @param {string} subResource - The sub-resource (e.g., 'default')
 * @param {Object} requestBody - The request body
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {Object} queryParams - The query parameters
 * @returns {Promise<Object>} The API response
 */
async function routeRequest(httpMethod, resource, resourceId, subResource, requestBody, dynamodb, queryParams) {
  // Handle categories
  if (resource === 'categories') {
    return await handleCategoryRequest(httpMethod, resourceId, requestBody, dynamodb);
  }

  // Handle templates
  else if (resource === 'templates') {
    return await handleTemplateRequest(httpMethod, resourceId, subResource, requestBody, dynamodb, queryParams);
  }

  // Handle variables
  else if (resource === 'variables') {
    const category = queryParams && queryParams.category;
    return await handleVariableRequest(httpMethod, category, dynamodb);
  }

  // If no handler matched, return 404
  return createResponse(404, { message: 'Not Found' });
}

/**
 * Handle requests for the categories resource
 * @param {string} httpMethod - The HTTP method
 * @param {string} categoryId - The category ID
 * @param {Object} requestBody - The request body
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @returns {Promise<Object>} The API response
 */
async function handleCategoryRequest(httpMethod, categoryId, requestBody, dynamodb) {
  switch (httpMethod) {
    case 'GET':
      return categoryId
        ? await categoryService.getCategory(dynamodb, categoryId)
        : await categoryService.listCategories(dynamodb);

    case 'POST':
      return await categoryService.createCategory(dynamodb, requestBody);

    case 'PUT':
      if (categoryId) {
        return await categoryService.updateCategory(dynamodb, categoryId, requestBody);
      }
      break;

    case 'DELETE':
      if (categoryId) {
        return await categoryService.deleteCategory(dynamodb, categoryId);
      }
      break;
  }

  return createResponse(404, { message: 'Not Found' });
}

/**
 * Handle requests for the templates resource
 * @param {string} httpMethod - The HTTP method
 * @param {string} templateId - The template ID
 * @param {string} subResource - The sub-resource (e.g., 'default')
 * @param {Object} requestBody - The request body
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {Object} queryParams - The query parameters
 * @returns {Promise<Object>} The API response
 */
async function handleTemplateRequest(httpMethod, templateId, subResource, requestBody, dynamodb, queryParams) {
  // Handle special case for setting default template
  if (httpMethod === 'PUT' && templateId && subResource === 'default') {
    return await templateService.setDefaultTemplate(dynamodb, templateId);
  }

  switch (httpMethod) {
    case 'GET':
      if (templateId) {
        return await templateService.getTemplate(dynamodb, templateId);
      } else {
        // Extract categoryId from query parameters if available
        const categoryId = queryParams && queryParams.categoryId;
        return await templateService.listTemplates(dynamodb, categoryId);
      }

    case 'POST':
      return await templateService.createTemplate(dynamodb, requestBody);

    case 'PUT':
      if (templateId) {
        return await templateService.updateTemplate(dynamodb, templateId, requestBody);
      }
      break;

    case 'DELETE':
      if (templateId) {
        return await templateService.deleteTemplate(dynamodb, templateId);
      }
      break;
  }

  return createResponse(404, { message: 'Not Found' });
}

/**
 * Handle requests for the variables resource
 * @param {string} httpMethod - The HTTP method
 * @param {string} category - The category to filter by
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @returns {Promise<Object>} The API response
 */
async function handleVariableRequest(httpMethod, category, dynamodb) {
  if (httpMethod === 'GET') {
    return await variableService.listVariables(dynamodb, category);
  }

  return createResponse(404, { message: 'Not Found' });
}

