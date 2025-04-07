import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Creates a DynamoDB document client
 * @returns {DynamoDBDocumentClient} The DynamoDB document client
 */
export function createDynamoDBClient() {
  const client = new DynamoDBClient({});
  return DynamoDBDocumentClient.from(client);
}

/**
 * Get an item from a DynamoDB table
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} tableName - The name of the table
 * @param {Object} key - The key of the item to get
 * @returns {Promise<Object>} The item
 */
export async function getItem(dynamodb, tableName, key) {
  const params = {
    TableName: tableName,
    Key: key
  };

  const result = await dynamodb.send(new GetCommand(params));
  return result.Item;
}

/**
 * Put an item in a DynamoDB table
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} tableName - The name of the table
 * @param {Object} item - The item to put
 * @param {string} [conditionExpression] - Optional condition expression
 * @returns {Promise<Object>} The result
 */
export async function putItem(dynamodb, tableName, item, conditionExpression) {
  const params = {
    TableName: tableName,
    Item: item
  };

  if (conditionExpression) {
    params.ConditionExpression = conditionExpression;
  }

  return await dynamodb.send(new PutCommand(params));
}

/**
 * Update an item in a DynamoDB table
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} tableName - The name of the table
 * @param {Object} key - The key of the item to update
 * @param {Object} updates - The updates to apply
 * @returns {Promise<Object>} The updated item
 */
export async function updateItem(dynamodb, tableName, key, updates) {
  // Build update expression
  let updateExpression = 'SET ';
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};

  Object.keys(updates).forEach((key, index) => {
    const valueKey = `:val${index}`;
    const nameKey = `#attr${index}`;
    updateExpression += index === 0 ? '' : ', ';
    updateExpression += `${nameKey} = ${valueKey}`;
    expressionAttributeValues[valueKey] = updates[key];
    expressionAttributeNames[nameKey] = key;
  });

  const params = {
    TableName: tableName,
    Key: key,
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: 'ALL_NEW'
  };

  const result = await dynamodb.send(new UpdateCommand(params));
  return result.Attributes;
}

/**
 * Delete an item from a DynamoDB table
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} tableName - The name of the table
 * @param {Object} key - The key of the item to delete
 * @returns {Promise<Object>} The result
 */
export async function deleteItem(dynamodb, tableName, key) {
  const params = {
    TableName: tableName,
    Key: key
  };

  return await dynamodb.send(new DeleteCommand(params));
}

/**
 * Scan a DynamoDB table
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} tableName - The name of the table
 * @returns {Promise<Array>} The items
 */
export async function scanTable(dynamodb, tableName) {
  const params = {
    TableName: tableName
  };

  const result = await dynamodb.send(new ScanCommand(params));
  return result.Items;
}

/**
 * Query a DynamoDB table
 * @param {DynamoDBDocumentClient} dynamodb - The DynamoDB document client
 * @param {string} tableName - The name of the table
 * @param {string} indexName - The name of the index to query
 * @param {string} keyConditionExpression - The key condition expression
 * @param {Object} expressionAttributeValues - The expression attribute values
 * @returns {Promise<Array>} The items
 */
export async function queryTable(dynamodb, tableName, indexName, keyConditionExpression, expressionAttributeValues) {
  const params = {
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: expressionAttributeValues
  };

  const result = await dynamodb.send(new QueryCommand(params));
  return result.Items;
}