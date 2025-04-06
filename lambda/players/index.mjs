import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const PLAYERS_TABLE = process.env.PLAYERS_TABLE;
const TEAMS_TABLE = process.env.TEAMS_TABLE;

/**
 * Main handler for Players Lambda function
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
        const playerId = pathParameters?.playerId;
        const parsedBody = body ? JSON.parse(body) : {};

        // Route to the appropriate handler based on HTTP method
        switch (httpMethod) {
            case 'GET':
                if (playerId) {
                    // Get single player by ID
                    response.body = JSON.stringify(await getPlayer(playerId));
                } else {
                    // List players, optionally filtered by team
                    response.body = JSON.stringify(await listPlayers(queryStringParameters));
                }
                break;

            case 'POST':
                // Create a new player
                response.statusCode = 201;
                response.body = JSON.stringify(await createPlayer(parsedBody));
                break;

            case 'PUT':
                // Update an existing player
                if (!playerId) {
                    throw new Error('Player ID is required for updates');
                }
                response.body = JSON.stringify(await updatePlayer(playerId, parsedBody));
                break;

            case 'DELETE':
                // Delete a player
                if (!playerId) {
                    throw new Error('Player ID is required for deletion');
                }
                await deletePlayer(playerId);
                response.body = JSON.stringify({ message: 'Player deleted successfully' });
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
 * Create a new player
 * @param {Object} playerData - The player data
 * @returns {Promise<Object>} - The created player
 */
async function createPlayer(playerData) {
    // Generate a unique ID if not provided
    const playerId = playerData.playerId || uuidv4();

    // Add timestamps
    const timestamp = new Date().toISOString();

    const player = {
        playerId,
        ...playerData,
        createdAt: timestamp,
        updatedAt: timestamp
    };

    // Validate required fields
    if (!player.playerName) {
        const error = new Error('Player name is required');
        error.statusCode = 400;
        throw error;
    }

    if (!player.teamId) {
        const error = new Error('Team ID is required');
        error.statusCode = 400;
        throw error;
    }

    // Verify the team exists
    try {
        await verifyTeamExists(player.teamId);
    } catch (error) {
        error.statusCode = 400;
        throw error;
    }

    const params = {
        TableName: PLAYERS_TABLE,
        Item: player,
        // Make sure the player doesn't already exist
        ConditionExpression: 'attribute_not_exists(playerId)'
    };

    try {
        await dynamodb.send(new PutCommand(params));
        return player;
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            const conflictError = new Error(`Player with ID ${playerId} already exists`);
            conflictError.statusCode = 409;
            throw conflictError;
        }
        throw error;
    }
}

/**
 * Get a player by ID
 * @param {string} playerId - The ID of the player to retrieve
 * @returns {Promise<Object>} - The requested player
 */
async function getPlayer(playerId) {
    const params = {
        TableName: PLAYERS_TABLE,
        Key: { playerId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        const error = new Error(`Player with ID ${playerId} not found`);
        error.statusCode = 404;
        throw error;
    }

    return result.Item;
}

/**
 * List players with optional filtering
 * @param {Object} queryParams - Query parameters for filtering
 * @returns {Promise<Array>} - List of players
 */
async function listPlayers(queryParams = {}) {
    // Ensure queryParams is an object even if null is explicitly passed
    const safeQueryParams = queryParams ?? {};
    const { teamId, position, limit } = safeQueryParams;

    let params = {
        TableName: PLAYERS_TABLE
    };

    // If teamId is specified, use the GSI
    if (teamId) {
        params = {
            ...params,
            IndexName: 'TeamIndex',
            KeyConditionExpression: 'teamId = :teamId',
            ExpressionAttributeValues: { ':teamId': teamId }
        };

        // If position is also specified, add a filter
        if (position) {
            params.FilterExpression = 'position = :position';
            params.ExpressionAttributeValues[':position'] = position;
        }

        const result = await dynamodb.send(new QueryCommand(params));
        return result.Items;
    }

    // If only position is specified, use a scan with filter
    if (position) {
        params.FilterExpression = 'position = :position';
        params.ExpressionAttributeValues = { ':position': position };
    }

    // Set result limit if specified
    if (limit) {
        params.Limit = parseInt(limit, 10);
    }

    const result = await dynamodb.send(new ScanCommand(params));
    return result.Items;
}

/**
 * Update an existing player
 * @param {string} playerId - The ID of the player to update
 * @param {Object} playerData - The updated player data
 * @returns {Promise<Object>} - The updated player
 */
async function updatePlayer(playerId, playerData) {
    // First check if the player exists
    const existingPlayer = await getPlayer(playerId);

    // If teamId is being changed, verify the new team exists
    if (playerData.teamId && playerData.teamId !== existingPlayer.teamId) {
        try {
            await verifyTeamExists(playerData.teamId);
        } catch (error) {
            error.statusCode = 400;
            throw error;
        }
    }

    // Add updated timestamp
    const timestamp = new Date().toISOString();

    // Create expressions for the update
    const { updateExpression, expressionAttributeValues, expressionAttributeNames } = buildUpdateExpression(
        { ...playerData, updatedAt: timestamp }
    );

    const params = {
        TableName: PLAYERS_TABLE,
        Key: { playerId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Delete a player
 * @param {string} playerId - The ID of the player to delete
 * @returns {Promise<void>}
 */
async function deletePlayer(playerId) {
    // First check if the player exists
    await getPlayer(playerId);

    const params = {
        TableName: PLAYERS_TABLE,
        Key: { playerId }
    };

    await dynamodb.send(new DeleteCommand(params));
}

/**
 * Verify that a team exists
 * @param {string} teamId - The ID of the team to verify
 * @returns {Promise<boolean>} - True if the team exists
 */
async function verifyTeamExists(teamId) {
    const params = {
        TableName: TEAMS_TABLE,
        Key: { teamId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        throw new Error(`Team with ID ${teamId} not found`);
    }

    return true;
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
        if (key === 'playerId' || value === null || value === undefined) {
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
