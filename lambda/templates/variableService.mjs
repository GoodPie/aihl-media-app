import * as db from './db.mjs';
import { createSuccessResponse } from './utils.mjs';

// Table name
const TEMPLATE_VARIABLES_TABLE = 'TemplateVariables';

/**
 * List all template variables, optionally filtered by category
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} [category] - Optional category to filter by
 * @returns {Promise<Object>} The API response
 */
export async function listVariables(dynamodb, category) {
  let items;
  
  if (category) {
    items = await db.queryTable(
      dynamodb,
      TEMPLATE_VARIABLES_TABLE,
      'CategoryIndex',
      'category = :category',
      { ':category': category }
    );
  } else {
    items = await db.scanTable(dynamodb, TEMPLATE_VARIABLES_TABLE);
  }
  
  return createSuccessResponse(items);
}