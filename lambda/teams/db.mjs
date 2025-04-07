import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// Table name from environment variable
const TABLE_NAME = process.env.TEAMS_TABLE;

/**
 * Get a team by ID
 * @param {string} teamId - The ID of the team to retrieve
 * @returns {Promise<Object>} - The requested team
 */
export async function getTeam(teamId) {
    const params = {
        TableName: TABLE_NAME,
        Key: { teamId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        const error = new Error(`Team with ID ${teamId} not found`);
        error.statusCode = 404;
        throw error;
    }

    return result.Item;
}

/**
 * List all teams with optional filtering
 * @param {Object} queryParams - Query parameters for filtering
 * @returns {Promise<Array>} - List of teams
 */
export async function listTeams(queryParams = {}) {
    // Ensure queryParams is an object even if null is explicitly passed
    const safeQueryParams = queryParams ?? {};
    const { division, limit } = safeQueryParams;

    let params = {
        TableName: TABLE_NAME
    };

    // If division is specified, filter by it
    if (division) {
        params = {
            ...params,
            FilterExpression: 'division = :division',
            ExpressionAttributeValues: { ':division': division }
        };
    }

    // Set result limit if specified
    if (limit) {
        params.Limit = parseInt(limit, 10);
    }

    const result = await dynamodb.send(new ScanCommand(params));
    return result.Items;
}

/**
 * Create a new team in the database
 * @param {Object} team - The team object to create
 * @returns {Promise<Object>} - The created team
 */
export async function createTeamInDB(team) {
    const params = {
        TableName: TABLE_NAME,
        Item: team,
        // Make sure the team doesn't already exist
        ConditionExpression: 'attribute_not_exists(teamId)'
    };

    try {
        await dynamodb.send(new PutCommand(params));
        return team;
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            const conflictError = new Error(`Team with ID ${team.teamId} already exists`);
            conflictError.statusCode = 409;
            throw conflictError;
        }
        throw error;
    }
}

/**
 * Update a team in the database
 * @param {string} teamId - The ID of the team to update
 * @param {string} updateExpression - The DynamoDB update expression
 * @param {Object} expressionAttributeValues - The expression attribute values
 * @param {Object} expressionAttributeNames - The expression attribute names
 * @returns {Promise<Object>} - The updated team
 */
export async function updateTeamInDB(teamId, updateExpression, expressionAttributeValues, expressionAttributeNames) {
    const params = {
        TableName: TABLE_NAME,
        Key: { teamId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Delete a team from the database
 * @param {string} teamId - The ID of the team to delete
 * @returns {Promise<void>}
 */
export async function deleteTeamFromDB(teamId) {
    const params = {
        TableName: TABLE_NAME,
        Key: { teamId }
    };

    await dynamodb.send(new DeleteCommand(params));
}