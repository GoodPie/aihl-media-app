import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const GAMES_TABLE = process.env.GAMES_TABLE;
const TEAMS_TABLE = process.env.TEAMS_TABLE;

/**
 * Main handler for Games Lambda function
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
        const gameId = pathParameters?.gameId;
        const action = pathParameters?.action; // For special actions like start, stop, etc.
        const parsedBody = body ? JSON.parse(body) : {};

        // Route to the appropriate handler based on HTTP method and path
        switch (httpMethod) {
            case 'GET':
                if (gameId) {
                    // Get single game by ID
                    response.body = JSON.stringify(await getGame(gameId));
                } else {
                    // List games, optionally filtered
                    response.body = JSON.stringify(await listGames(queryStringParameters));
                }
                break;

            case 'POST':
                // Create a new game
                response.statusCode = 201;
                response.body = JSON.stringify(await createGame(parsedBody));
                break;

            case 'PUT':
                if (!gameId) {
                    throw new Error('Game ID is required for updates');
                }

                // Check if this is a special action
                if (action) {
                    switch (action) {
                        case 'start':
                            response.body = JSON.stringify(await startGame(gameId));
                            break;

                        case 'stop':
                            response.body = JSON.stringify(await stopGame(gameId));
                            break;

                        case 'update-score':
                            response.body = JSON.stringify(await updateScore(gameId, parsedBody));
                            break;

                        case 'update-time':
                            response.body = JSON.stringify(await updateTime(gameId, parsedBody));
                            break;

                        case 'next-period':
                            response.body = JSON.stringify(await nextPeriod(gameId));
                            break;

                        default:
                            throw new Error(`Unsupported action: ${action}`);
                    }
                } else {
                    // Regular update
                    response.body = JSON.stringify(await updateGame(gameId, parsedBody));
                }
                break;

            case 'DELETE':
                // Delete a game
                if (!gameId) {
                    throw new Error('Game ID is required for deletion');
                }
                await deleteGame(gameId);
                response.body = JSON.stringify({ message: 'Game deleted successfully' });
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
 * Create a new game
 * @param {Object} gameData - The game data
 * @returns {Promise<Object>} - The created game
 */
async function createGame(gameData) {
    // Generate a unique ID if not provided
    const gameId = gameData.gameId || uuidv4();

    // Add timestamps
    const timestamp = new Date().toISOString();

    // Initialize game with default values
    const game = {
        gameId,
        ...gameData,
        status: 'scheduled', // scheduled, in_progress, completed, cancelled
        currentPeriod: 1,
        currentGameTime: '20:00', // Format: MM:SS for time remaining in period
        homeScore: 0,
        awayScore: 0,
        createdAt: timestamp,
        updatedAt: timestamp
    };

    // Validate required fields
    if (!game.homeTeamId) {
        const error = new Error('Home team ID is required');
        error.statusCode = 400;
        throw error;
    }

    if (!game.awayTeamId) {
        const error = new Error('Away team ID is required');
        error.statusCode = 400;
        throw error;
    }

    if (!game.gameDate) {
        const error = new Error('Game date is required');
        error.statusCode = 400;
        throw error;
    }

    // Verify the teams exist
    try {
        const homeTeam = await verifyTeamExists(game.homeTeamId);
        const awayTeam = await verifyTeamExists(game.awayTeamId);

        // Add team names for convenience
        game.homeTeamName = homeTeam.teamName;
        game.awayTeamName = awayTeam.teamName;
    } catch (error) {
        error.statusCode = 400;
        throw error;
    }

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
            const conflictError = new Error(`Game with ID ${gameId} already exists`);
            conflictError.statusCode = 409;
            throw conflictError;
        }
        throw error;
    }
}

/**
 * Get a game by ID
 * @param {string} gameId - The ID of the game to retrieve
 * @returns {Promise<Object>} - The requested game
 */
async function getGame(gameId) {
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
async function listGames(queryParams = {}) {
    const { status, teamId, date, limit } = queryParams;

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
 * Update an existing game
 * @param {string} gameId - The ID of the game to update
 * @param {Object} gameData - The updated game data
 * @returns {Promise<Object>} - The updated game
 */
async function updateGame(gameId, gameData) {
    // First check if the game exists
    const existingGame = await getGame(gameId);

    // If team IDs are being changed, verify the new teams exist
    if (gameData.homeTeamId && gameData.homeTeamId !== existingGame.homeTeamId) {
        const homeTeam = await verifyTeamExists(gameData.homeTeamId);
        gameData.homeTeamName = homeTeam.teamName;
    }

    if (gameData.awayTeamId && gameData.awayTeamId !== existingGame.awayTeamId) {
        const awayTeam = await verifyTeamExists(gameData.awayTeamId);
        gameData.awayTeamName = awayTeam.teamName;
    }

    // Add updated timestamp
    const timestamp = new Date().toISOString();

    // Create expressions for the update
    const { updateExpression, expressionAttributeValues, expressionAttributeNames } = buildUpdateExpression(
        { ...gameData, updatedAt: timestamp }
    );

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
 * Delete a game
 * @param {string} gameId - The ID of the game to delete
 * @returns {Promise<void>}
 */
async function deleteGame(gameId) {
    // First check if the game exists
    await getGame(gameId);

    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId }
    };

    await dynamodb.send(new DeleteCommand(params));
}

/**
 * Start a game
 * @param {string} gameId - The ID of the game to start
 * @returns {Promise<Object>} - The updated game
 */
async function startGame(gameId) {
    // Check if the game exists
    const game = await getGame(gameId);

    // Check if the game is in a valid state to start
    if (game.status === 'in_progress') {
        const error = new Error('Game is already in progress');
        error.statusCode = 400;
        throw error;
    }

    if (game.status === 'completed') {
        const error = new Error('Cannot start a completed game');
        error.statusCode = 400;
        throw error;
    }

    // Update the game
    const timestamp = new Date().toISOString();

    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId },
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #startTime = :startTime',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updatedAt',
            '#startTime': 'startTime'
        },
        ExpressionAttributeValues: {
            ':status': 'in_progress',
            ':updatedAt': timestamp,
            ':startTime': timestamp
        },
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Stop a game (mark as completed)
 * @param {string} gameId - The ID of the game to stop
 * @returns {Promise<Object>} - The updated game
 */
async function stopGame(gameId) {
    // Check if the game exists
    const game = await getGame(gameId);

    // Check if the game is in a valid state to stop
    if (game.status !== 'in_progress') {
        const error = new Error('Can only stop a game that is in progress');
        error.statusCode = 400;
        throw error;
    }

    // Update the game
    const timestamp = new Date().toISOString();

    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId },
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, #endTime = :endTime',
        ExpressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updatedAt',
            '#endTime': 'endTime'
        },
        ExpressionAttributeValues: {
            ':status': 'completed',
            ':updatedAt': timestamp,
            ':endTime': timestamp
        },
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Update the score for a game
 * @param {string} gameId - The ID of the game
 * @param {Object} scoreData - The score data { homeScore, awayScore }
 * @returns {Promise<Object>} - The updated game
 */
async function updateScore(gameId, scoreData) {
    // Check if the game exists and is in progress
    const game = await getGame(gameId);

    if (game.status !== 'in_progress') {
        const error = new Error('Can only update score for a game in progress');
        error.statusCode = 400;
        throw error;
    }

    // Validate score data
    if (scoreData.homeScore === undefined && scoreData.awayScore === undefined) {
        const error = new Error('Either homeScore or awayScore must be provided');
        error.statusCode = 400;
        throw error;
    }

    // Prepare the update
    const timestamp = new Date().toISOString();
    let updateExpression = 'SET #updatedAt = :updatedAt';
    const expressionAttributeNames = { '#updatedAt': 'updatedAt' };
    const expressionAttributeValues = { ':updatedAt': timestamp };

    if (scoreData.homeScore !== undefined) {
        updateExpression += ', #homeScore = :homeScore';
        expressionAttributeNames['#homeScore'] = 'homeScore';
        expressionAttributeValues[':homeScore'] = parseInt(scoreData.homeScore, 10);
    }

    if (scoreData.awayScore !== undefined) {
        updateExpression += ', #awayScore = :awayScore';
        expressionAttributeNames['#awayScore'] = 'awayScore';
        expressionAttributeValues[':awayScore'] = parseInt(scoreData.awayScore, 10);
    }

    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Update the game time
 * @param {string} gameId - The ID of the game
 * @param {Object} timeData - The time data { currentGameTime }
 * @returns {Promise<Object>} - The updated game
 */
async function updateTime(gameId, timeData) {
    // Check if the game exists and is in progress
    const game = await getGame(gameId);

    if (game.status !== 'in_progress') {
        const error = new Error('Can only update time for a game in progress');
        error.statusCode = 400;
        throw error;
    }

    // Validate time data
    if (!timeData.currentGameTime) {
        const error = new Error('currentGameTime must be provided');
        error.statusCode = 400;
        throw error;
    }

    // Validate time format (MM:SS)
    const timeRegex = /^([0-9]{1,2}):([0-5][0-9])$/;
    if (!timeRegex.test(timeData.currentGameTime)) {
        const error = new Error('currentGameTime must be in MM:SS format');
        error.statusCode = 400;
        throw error;
    }

    // Prepare the update
    const timestamp = new Date().toISOString();

    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId },
        UpdateExpression: 'SET #currentGameTime = :currentGameTime, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
            '#currentGameTime': 'currentGameTime',
            '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: {
            ':currentGameTime': timeData.currentGameTime,
            ':updatedAt': timestamp
        },
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Move to the next period
 * @param {string} gameId - The ID of the game
 * @returns {Promise<Object>} - The updated game
 */
async function nextPeriod(gameId) {
    // Check if the game exists and is in progress
    const game = await getGame(gameId);

    if (game.status !== 'in_progress') {
        const error = new Error('Can only change period for a game in progress');
        error.statusCode = 400;
        throw error;
    }

    // Check if we're already at the max period (3 for regular, 4 for OT, 5 for shootout)
    if (game.currentPeriod >= 5) {
        const error = new Error('Already at maximum period');
        error.statusCode = 400;
        throw error;
    }

    // Prepare the update
    const timestamp = new Date().toISOString();
    const nextPeriod = game.currentPeriod + 1;

    // Reset game time (20:00 for regular periods, 5:00 for OT)
    const periodTime = nextPeriod <= 3 ? '20:00' : '5:00';

    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId },
        UpdateExpression: 'SET #currentPeriod = :currentPeriod, #currentGameTime = :currentGameTime, #updatedAt = :updatedAt',
        ExpressionAttributeNames: {
            '#currentPeriod': 'currentPeriod',
            '#currentGameTime': 'currentGameTime',
            '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: {
            ':currentPeriod': nextPeriod,
            ':currentGameTime': periodTime,
            ':updatedAt': timestamp
        },
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Verify that a team exists
 * @param {string} teamId - The ID of the team to verify
 * @returns {Promise<Object>} - The team object if it exists
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

    return result.Item;
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
        if (key === 'gameId' || value === null || value === undefined) {
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
