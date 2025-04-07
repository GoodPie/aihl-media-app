import * as db from './db.mjs';
import { addTimestamps, createSuccessResponse, createCreatedResponse, createNoContentResponse, createNotFoundResponse } from './utils.mjs';

// Table name
const TEMPLATE_CATEGORIES_TABLE = process.env.TEMPLATE_CATEGORIES_TABLE || 'TemplateCategories';

/**
 * List all categories
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @returns {Promise<Object>} The API response
 */
export async function listCategories(dynamodb) {
  const items = await db.scanTable(dynamodb, TEMPLATE_CATEGORIES_TABLE);
  return createSuccessResponse(items);
}

/**
 * Get a specific category
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} categoryId - The category ID
 * @returns {Promise<Object>} The API response
 */
export async function getCategory(dynamodb, categoryId) {
  const item = await db.getItem(dynamodb, TEMPLATE_CATEGORIES_TABLE, { categoryId });
  
  if (!item) {
    return createNotFoundResponse('Category not found');
  }
  
  return createSuccessResponse(item);
}

/**
 * Create a new category
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {Object} category - The category to create
 * @returns {Promise<Object>} The API response
 */
export async function createCategory(dynamodb, category) {
  // Add timestamps
  const categoryWithTimestamps = addTimestamps(category, true);
  
  await db.putItem(
    dynamodb, 
    TEMPLATE_CATEGORIES_TABLE, 
    categoryWithTimestamps, 
    'attribute_not_exists(categoryId)'
  );
  
  return createCreatedResponse(categoryWithTimestamps);
}

/**
 * Update a category
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} categoryId - The category ID
 * @param {Object} updates - The updates to apply
 * @returns {Promise<Object>} The API response
 */
export async function updateCategory(dynamodb, categoryId, updates) {
  // Add timestamps
  const updatesWithTimestamps = addTimestamps(updates);
  
  const updatedItem = await db.updateItem(
    dynamodb, 
    TEMPLATE_CATEGORIES_TABLE, 
    { categoryId }, 
    updatesWithTimestamps
  );
  
  return createSuccessResponse(updatedItem);
}

/**
 * Delete a category
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} categoryId - The category ID
 * @returns {Promise<Object>} The API response
 */
export async function deleteCategory(dynamodb, categoryId) {
  await db.deleteItem(dynamodb, TEMPLATE_CATEGORIES_TABLE, { categoryId });
  return createNoContentResponse('Category deleted successfully');
}