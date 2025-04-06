import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// Table names from environment variables
const GAMES_TABLE = process.env.GAMES_TABLE;
const TEAMS_TABLE = process.env.TEAMS_TABLE;

/**
 * Get a game by ID
 * @param {string} gameId - The ID of the game to retrieve
 * @returns {Promise<Object>} - The requested game
 */
export async function getGame(gameId) {
    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        const error = new Error(`Game with ID ${gameId} not found`);
        error.statusCode = 404;
        throw error;
    }

    return result.Item;
}

/**
 * List games with optional filtering
 * @param {Object} queryParams - Query parameters for filtering
 * @returns {Promise<Array>} - List of games
 */
export async function listGames(queryParams = {}) {
    // Ensure queryParams is an object even if null is explicitly passed
    const safeQueryParams = queryParams ?? {};
    const { status, teamId, date, limit } = safeQueryParams;

    // If status is specified, use the GSI
    if (status) {
        const params = {
            TableName: GAMES_TABLE,
            IndexName: 'StatusIndex',
            KeyConditionExpression: 'status = :status',
            ExpressionAttributeValues: { ':status': status }
        };

        // If date is also specified, use it for the range key
        if (date) {
            params.KeyConditionExpression += ' AND gameDate = :gameDate';
            params.ExpressionAttributeValues[':gameDate'] = date;
        }

        // Set result limit if specified
        if (limit) {
            params.Limit = parseInt(limit, 10);
        }

        const result = await dynamodb.send(new QueryCommand(params));

        // If teamId is specified, filter the results
        if (teamId) {
            return result.Items.filter(game =>
                game.homeTeamId === teamId || game.awayTeamId === teamId
            );
        }

        return result.Items;
    }

    // If no status is specified, fall back to scan
    let params = {
        TableName: GAMES_TABLE
    };

    // Apply filters if needed
    let filterExpressions = [];
    let expressionAttributeValues = {};

    if (date) {
        filterExpressions.push('gameDate = :gameDate');
        expressionAttributeValues[':gameDate'] = date;
    }

    if (teamId) {
        filterExpressions.push('(homeTeamId = :teamId OR awayTeamId = :teamId)');
        expressionAttributeValues[':teamId'] = teamId;
    }

    if (filterExpressions.length > 0) {
        params.FilterExpression = filterExpressions.join(' AND ');
        params.ExpressionAttributeValues = expressionAttributeValues;
    }

    // Set result limit if specified
    if (limit) {
        params.Limit = parseInt(limit, 10);
    }

    const result = await dynamodb.send(new ScanCommand(params));
    return result.Items;
}

/**
 * Create a new game in the database
 * @param {Object} game - The game object to create
 * @returns {Promise<Object>} - The created game
 */
export async function createGameInDB(game) {
    const params = {
        TableName: GAMES_TABLE,
        Item: game,
        // Make sure the game doesn't already exist
        ConditionExpression: 'attribute_not_exists(gameId)'
    };

    try {
        await dynamodb.send(new PutCommand(params));
        return game;
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            const conflictError = new Error(`Game with ID ${game.gameId} already exists`);
            conflictError.statusCode = 409;
            throw conflictError;
        }
        throw error;
    }
}

/**
 * Update a game in the database
 * @param {string} gameId - The ID of the game to update
 * @param {string} updateExpression - The DynamoDB update expression
 * @param {Object} expressionAttributeValues - The expression attribute values
 * @param {Object} expressionAttributeNames - The expression attribute names
 * @returns {Promise<Object>} - The updated game
 */
export async function updateGameInDB(gameId, updateExpression, expressionAttributeValues, expressionAttributeNames) {
    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Delete a game from the database
 * @param {string} gameId - The ID of the game to delete
 * @returns {Promise<void>}
 */
export async function deleteGameFromDB(gameId) {
    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId }
    };

    await dynamodb.send(new DeleteCommand(params));
}

/**
 * Verify that a team exists
 * @param {string} teamId - The ID of the team to verify
 * @returns {Promise<Object>} - The team object if it exists
 */
export async function verifyTeamExists(teamId) {
    const params = {
        TableName: TEAMS_TABLE,
        Key: { teamId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        throw new Error(`Team with ID ${teamId} not found`);
    }

    return result.Item;
}