import { v4 as uuidv4 } from 'uuid';
import { getGame, createGameInDB, updateGameInDB, deleteGameFromDB, verifyTeamExists } from './db.mjs';
import { buildUpdateExpression } from './utils.mjs';

/**
 * Create a new game
 * @param {Object} gameData - The game data
 * @returns {Promise<Object>} - The created game
 */
export async function createGame(gameData) {
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

    return await createGameInDB(game);
}

/**
 * Update an existing game
 * @param {string} gameId - The ID of the game to update
 * @param {Object} gameData - The updated game data
 * @returns {Promise<Object>} - The updated game
 */
export async function updateGame(gameId, gameData) {
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

    return await updateGameInDB(gameId, updateExpression, expressionAttributeValues, expressionAttributeNames);
}

/**
 * Delete a game
 * @param {string} gameId - The ID of the game to delete
 * @returns {Promise<void>}
 */
export async function deleteGame(gameId) {
    // First check if the game exists
    await getGame(gameId);
    await deleteGameFromDB(gameId);
}

/**
 * Start a game
 * @param {string} gameId - The ID of the game to start
 * @returns {Promise<Object>} - The updated game
 */
export async function startGame(gameId) {
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

    const updateExpression = 'SET #status = :status, #updatedAt = :updatedAt, #startTime = :startTime';
    const expressionAttributeNames = {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#startTime': 'startTime'
    };
    const expressionAttributeValues = {
        ':status': 'in_progress',
        ':updatedAt': timestamp,
        ':startTime': timestamp
    };

    return await updateGameInDB(gameId, updateExpression, expressionAttributeValues, expressionAttributeNames);
}

/**
 * Stop a game (mark as completed)
 * @param {string} gameId - The ID of the game to stop
 * @returns {Promise<Object>} - The updated game
 */
export async function stopGame(gameId) {
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

    const updateExpression = 'SET #status = :status, #updatedAt = :updatedAt, #endTime = :endTime';
    const expressionAttributeNames = {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
        '#endTime': 'endTime'
    };
    const expressionAttributeValues = {
        ':status': 'completed',
        ':updatedAt': timestamp,
        ':endTime': timestamp
    };

    return await updateGameInDB(gameId, updateExpression, expressionAttributeValues, expressionAttributeNames);
}

/**
 * Update the score for a game
 * @param {string} gameId - The ID of the game
 * @param {Object} scoreData - The score data { homeScore, awayScore }
 * @returns {Promise<Object>} - The updated game
 */
export async function updateScore(gameId, scoreData) {
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

    return await updateGameInDB(gameId, updateExpression, expressionAttributeValues, expressionAttributeNames);
}

/**
 * Update the game time
 * @param {string} gameId - The ID of the game
 * @param {Object} timeData - The time data { currentGameTime }
 * @returns {Promise<Object>} - The updated game
 */
export async function updateTime(gameId, timeData) {
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

    const updateExpression = 'SET #currentGameTime = :currentGameTime, #updatedAt = :updatedAt';
    const expressionAttributeNames = {
        '#currentGameTime': 'currentGameTime',
        '#updatedAt': 'updatedAt'
    };
    const expressionAttributeValues = {
        ':currentGameTime': timeData.currentGameTime,
        ':updatedAt': timestamp
    };

    return await updateGameInDB(gameId, updateExpression, expressionAttributeValues, expressionAttributeNames);
}

/**
 * Move to the next period
 * @param {string} gameId - The ID of the game
 * @returns {Promise<Object>} - The updated game
 */
export async function nextPeriod(gameId) {
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

    const updateExpression = 'SET #currentPeriod = :currentPeriod, #currentGameTime = :currentGameTime, #updatedAt = :updatedAt';
    const expressionAttributeNames = {
        '#currentPeriod': 'currentPeriod',
        '#currentGameTime': 'currentGameTime',
        '#updatedAt': 'updatedAt'
    };
    const expressionAttributeValues = {
        ':currentPeriod': nextPeriod,
        ':currentGameTime': periodTime,
        ':updatedAt': timestamp
    };

    return await updateGameInDB(gameId, updateExpression, expressionAttributeValues, expressionAttributeNames);
}