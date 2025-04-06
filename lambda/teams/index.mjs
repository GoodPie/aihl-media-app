import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TEAMS_TABLE;

/**
 * Main handler for Teams Lambda function
 */
export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Initialize response with CORS headers
    let response = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',  // For CORS support
            'Access-Control-Allow-Credentials': true,
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'
        },
        body: ''
    };

    // Handle OPTIONS method for CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return response;
    }

    try {
        // Extract operation details from the event
        const { httpMethod, pathParameters, queryStringParameters, body } = event;
        const teamId = pathParameters?.teamId;
        const parsedBody = body ? JSON.parse(body) : {};

        // Route to the appropriate handler based on HTTP method
        switch (httpMethod) {
            case 'GET':
                if (teamId) {
                    // Get single team by ID
                    response.body = JSON.stringify(await getTeam(teamId));
                } else {
                    // List all teams, optionally filtered
                    response.body = JSON.stringify(await listTeams(queryStringParameters));
                }
                break;

            case 'POST':
                // Create a new team
                response.statusCode = 201;
                response.body = JSON.stringify(await createTeam(parsedBody));
                break;

            case 'PUT':
                // Update an existing team
                if (!teamId) {
                    throw new Error('Team ID is required for updates');
                }
                response.body = JSON.stringify(await updateTeam(teamId, parsedBody));
                break;

            case 'DELETE':
                // Delete a team
                if (!teamId) {
                    throw new Error('Team ID is required for deletion');
                }
                await deleteTeam(teamId);
                response.body = JSON.stringify({ message: 'Team deleted successfully' });
                break;

            default:
                throw new Error(`Unsupported method: ${httpMethod}`);
        }
    } catch (error) {
        console.error('Error processing request:', error);

        response.statusCode = error.statusCode || 500;
        response.body = JSON.stringify({
            message: error.message || 'An unexpected error occurred',
            errorType: error.name
        });
    }

    return response;
};

/**
 * Create a new team
 * @param {Object} teamData - The team data
 * @returns {Promise<Object>} - The created team
 */
async function createTeam(teamData) {
    // Generate a unique ID if not provided
    const teamId = teamData.teamId || uuidv4();

    // Add timestamps
    const timestamp = new Date().toISOString();

    const team = {
        teamId,
        ...teamData,
        createdAt: timestamp,
        updatedAt: timestamp
    };

    // Validate required fields
    if (!team.teamName) {
        const error = new Error('Team name is required');
        error.statusCode = 400;
        throw error;
    }

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
            const conflictError = new Error(`Team with ID ${teamId} already exists`);
            conflictError.statusCode = 409;
            throw conflictError;
        }
        throw error;
    }
}

/**
 * Get a team by ID
 * @param {string} teamId - The ID of the team to retrieve
 * @returns {Promise<Object>} - The requested team
 */
async function getTeam(teamId) {
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
async function listTeams(queryParams = {}) {
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
 * Update an existing team
 * @param {string} teamId - The ID of the team to update
 * @param {Object} teamData - The updated team data
 * @returns {Promise<Object>} - The updated team
 */
async function updateTeam(teamId, teamData) {
    // First check if the team exists
    await getTeam(teamId);

    // Add updated timestamp
    const timestamp = new Date().toISOString();

    // Create expressions for the update
    const { updateExpression, expressionAttributeValues, expressionAttributeNames } = buildUpdateExpression(
        { ...teamData, updatedAt: timestamp }
    );

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
 * Delete a team
 * @param {string} teamId - The ID of the team to delete
 * @returns {Promise<void>}
 */
async function deleteTeam(teamId) {
    // First check if the team exists
    await getTeam(teamId);

    const params = {
        TableName: TABLE_NAME,
        Key: { teamId }
    };

    await dynamodb.send(new DeleteCommand(params));
}

/**
 * Build an update expression for DynamoDB from an object
 * @param {Object} updateData - The data to update
 * @returns {Object} - The update expression, attribute values, and attribute names
 */
function buildUpdateExpression(updateData) {
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};
    const updateParts = [];

    Object.entries(updateData).forEach(([key, value]) => {
        // Skip the primary key and null values
        if (key === 'teamId' || value === null || value === undefined) {
            return;
        }

        const attributeName = `#${key}`;
        const attributeValue = `:${key}`;

        expressionAttributeNames[attributeName] = key;
        expressionAttributeValues[attributeValue] = value;
        updateParts.push(`${attributeName} = ${attributeValue}`);
    });

    if (updateParts.length === 0) {
        const error = new Error('No valid attributes to update');
        error.statusCode = 400;
        throw error;
    }

    return {
        updateExpression: `SET ${updateParts.join(', ')}`,
        expressionAttributeValues,
        expressionAttributeNames
    };
}
