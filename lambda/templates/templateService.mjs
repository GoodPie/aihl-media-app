import * as db from './db.mjs';
import { addTimestamps, createSuccessResponse, createCreatedResponse, createNoContentResponse, createNotFoundResponse } from './utils.mjs';

// Table name
const TEMPLATES_TABLE = process.env.TEMPLATES_TABLE || 'Templates';

/**
 * List all templates, optionally filtered by category
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} [categoryId] - Optional category ID to filter by
 * @returns {Promise<Object>} The API response
 */
export async function listTemplates(dynamodb, categoryId) {
  let items;
  
  if (categoryId) {
    items = await db.queryTable(
      dynamodb,
      TEMPLATES_TABLE,
      'CategoryIndex',
      'categoryId = :categoryId',
      { ':categoryId': categoryId }
    );
  } else {
    items = await db.scanTable(dynamodb, TEMPLATES_TABLE);
  }
  
  return createSuccessResponse(items);
}

/**
 * Get a specific template
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} templateId - The template ID
 * @returns {Promise<Object>} The API response
 */
export async function getTemplate(dynamodb, templateId) {
  const item = await db.getItem(dynamodb, TEMPLATES_TABLE, { templateId });
  
  if (!item) {
    return createNotFoundResponse('Template not found');
  }
  
  return createSuccessResponse(item);
}

/**
 * Create a new template
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {Object} template - The template to create
 * @returns {Promise<Object>} The API response
 */
export async function createTemplate(dynamodb, template) {
  // Generate a unique ID if one is not provided
  if (!template.templateId) {
    template.templateId = `${template.categoryId}-${Date.now()}`;
  }
  
  // Add timestamps
  const templateWithTimestamps = addTimestamps(template, true);
  
  await db.putItem(dynamodb, TEMPLATES_TABLE, templateWithTimestamps);
  
  return createCreatedResponse(templateWithTimestamps);
}

/**
 * Update a template
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} templateId - The template ID
 * @param {Object} updates - The updates to apply
 * @returns {Promise<Object>} The API response
 */
export async function updateTemplate(dynamodb, templateId, updates) {
  // Add timestamps
  const updatesWithTimestamps = addTimestamps(updates);
  
  const updatedItem = await db.updateItem(
    dynamodb, 
    TEMPLATES_TABLE, 
    { templateId }, 
    updatesWithTimestamps
  );
  
  return createSuccessResponse(updatedItem);
}

/**
 * Delete a template
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} templateId - The template ID
 * @returns {Promise<Object>} The API response
 */
export async function deleteTemplate(dynamodb, templateId) {
  await db.deleteItem(dynamodb, TEMPLATES_TABLE, { templateId });
  return createNoContentResponse('Template deleted successfully');
}

/**
 * Set a template as the default for its category
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} templateId - The template ID
 * @returns {Promise<Object>} The API response
 */
export async function setDefaultTemplate(dynamodb, templateId) {
  // First, get the template to determine its category
  const template = await db.getItem(dynamodb, TEMPLATES_TABLE, { templateId });
  
  if (!template) {
    return createNotFoundResponse('Template not found');
  }
  
  const categoryId = template.categoryId;
  
  // Find all templates in the same category
  const categoryTemplates = await db.queryTable(
    dynamodb,
    TEMPLATES_TABLE,
    'CategoryIndex',
    'categoryId = :categoryId',
    { ':categoryId': categoryId }
  );
  
  // Update each template in the category
  const updatePromises = categoryTemplates.map(item => {
    const updates = {
      isDefault: item.templateId === templateId,
      updatedAt: new Date().toISOString()
    };
    
    return db.updateItem(
      dynamodb, 
      TEMPLATES_TABLE, 
      { templateId: item.templateId }, 
      updates
    );
  });
  
  await Promise.all(updatePromises);
  
  return createSuccessResponse({
    message: `Template ${templateId} set as default for category ${categoryId}`
  });
}