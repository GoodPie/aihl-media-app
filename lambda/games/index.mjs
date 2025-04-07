import { getGame, listGames } from './db.mjs';
import {
    createGame,
    updateGame,
    deleteGame,
    startGame,
    stopGame,
    updateScore,
    updateTime,
    nextPeriod
} from './game-operations.mjs';

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
