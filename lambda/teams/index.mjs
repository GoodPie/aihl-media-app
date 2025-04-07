import { getTeam, listTeams } from './db.mjs';
import { createTeam, updateTeam, deleteTeam } from './team-operations.mjs';

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
