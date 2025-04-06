import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);
const EVENTS_TABLE = process.env.EVENTS_TABLE;
const GAMES_TABLE = process.env.GAMES_TABLE;
const PLAYERS_TABLE = process.env.PLAYERS_TABLE;
const TEAMS_TABLE = process.env.TEAMS_TABLE;
const TEMPLATES_TABLE = process.env.TEMPLATES_TABLE;

/**
 * Main handler for Events Lambda function
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
        const eventId = pathParameters?.eventId;
        const action = pathParameters?.action; // For special actions like generate-text
        const parsedBody = body ? JSON.parse(body) : {};

        // Route to the appropriate handler based on HTTP method and path
        switch (httpMethod) {
            case 'GET':
                if (eventId) {
                    // Get single event by ID
                    response.body = JSON.stringify(await getEvent(eventId));
                } else {
                    // List events, optionally filtered
                    response.body = JSON.stringify(await listEvents(queryStringParameters));
                }
                break;

            case 'POST':
                // Handle special actions via POST if present
                if (action === 'generate-text') {
                    if (!parsedBody.eventId && !parsedBody.templateId) {
                        throw new Error('Either eventId or manual event details with templateId are required');
                    }

                    if (parsedBody.eventId) {
                        // Generate text for an existing event
                        response.body = JSON.stringify(await generateTextForEvent(parsedBody.eventId, parsedBody.templateId));
                    } else {
                        // Generate text for a manual (non-saved) event
                        response.body = JSON.stringify(await generateTextForManualEvent(parsedBody));
                    }
                } else {
                    // Create a new event
                    response.statusCode = 201;
                    response.body = JSON.stringify(await createEvent(parsedBody));
                }
                break;

            case 'PUT':
                // Update an existing event
                if (!eventId) {
                    throw new Error('Event ID is required for updates');
                }

                if (action === 'generate-text') {
                    // Generate text for this event
                    response.body = JSON.stringify(await generateTextForEvent(eventId, parsedBody.templateId));
                } else {
                    // Regular update
                    response.body = JSON.stringify(await updateEvent(eventId, parsedBody));
                }
                break;

            case 'DELETE':
                // Delete an event
                if (!eventId) {
                    throw new Error('Event ID is required for deletion');
                }
                await deleteEvent(eventId);
                response.body = JSON.stringify({ message: 'Event deleted successfully' });
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
 * Create a new game event
 * @param {Object} eventData - The event data
 * @returns {Promise<Object>} - The created event with generated text
 */
async function createEvent(eventData) {
    // Generate a unique ID if not provided
    const eventId = eventData.eventId || uuidv4();

    // Add timestamps
    const timestamp = new Date().toISOString();

    const newEvent = {
        eventId,
        ...eventData,
        createdAt: timestamp,
        updatedAt: timestamp
    };

    // Validate required fields
    if (!newEvent.gameId) {
        const error = new Error('Game ID is required');
        error.statusCode = 400;
        throw error;
    }

    if (!newEvent.eventType) {
        const error = new Error('Event type is required');
        error.statusCode = 400;
        throw error;
    }

    // Verify the game exists and is in progress
    try {
        const game = await verifyGameExists(newEvent.gameId);

        if (game.status !== 'in_progress') {
            const error = new Error('Events can only be created for games in progress');
            error.statusCode = 400;
            throw error;
        }

        // Add game context to the event if not provided
        if (!newEvent.gameTime) {
            newEvent.gameTime = game.currentGameTime;
        }

        if (!newEvent.period) {
            newEvent.period = game.currentPeriod;
        }

        // Handle score updates for goal events
        if (newEvent.eventType === 'GOAL') {
            if (!newEvent.teamId) {
                const error = new Error('Team ID is required for goal events');
                error.statusCode = 400;
                throw error;
            }

            // Update the game score
            let homeScoreChange = 0;
            let awayScoreChange = 0;

            if (newEvent.teamId === game.homeTeamId) {
                homeScoreChange = 1;
            } else if (newEvent.teamId === game.awayTeamId) {
                awayScoreChange = 1;
            } else {
                const error = new Error('Invalid team ID for this game');
                error.statusCode = 400;
                throw error;
            }

            await updateGameScore(
                game.gameId,
                game.homeScore + homeScoreChange,
                game.awayScore + awayScoreChange
            );

            // Update the event with the new scores
            newEvent.homeScore = game.homeScore + homeScoreChange;
            newEvent.awayScore = game.awayScore + awayScoreChange;
        } else {
            // For non-goal events, just record the current score
            newEvent.homeScore = game.homeScore;
            newEvent.awayScore = game.awayScore;
        }
    } catch (error) {
        error.statusCode = 400;
        throw error;
    }

    // If playerId is provided, verify the player exists
    if (newEvent.playerId) {
        try {
            const player = await verifyPlayerExists(newEvent.playerId);

            // Add player details to the event
            newEvent.playerName = player.playerName;
            newEvent.playerNumber = player.jerseyNumber;

            // If team ID is not provided, get it from the player
            if (!newEvent.teamId) {
                newEvent.teamId = player.teamId;
            }
        } catch (error) {
            error.statusCode = 400;
            throw error;
        }
    }

    // If teamId is provided, verify the team exists
    if (newEvent.teamId) {
        try {
            const team = await verifyTeamExists(newEvent.teamId);

            // Add team details to the event
            newEvent.teamName = team.teamName;
        } catch (error) {
            error.statusCode = 400;
            throw error;
        }
    }

    // Generate text for this event using the default template
    try {
        const generatedText = await generateTextForEvent(null, null, newEvent);
        if (generatedText) {
            newEvent.generatedText = generatedText.text;
            newEvent.templateId = generatedText.templateId;
        }
    } catch (error) {
        console.warn('Failed to generate text for event:', error);
        // Continue even if text generation fails
    }

    // Save the event
    const params = {
        TableName: EVENTS_TABLE,
        Item: newEvent,
        // Make sure the event doesn't already exist
        ConditionExpression: 'attribute_not_exists(eventId)'
    };

    try {
        await dynamodb.send(new PutCommand(params));
        return newEvent;
    } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
            const conflictError = new Error(`Event with ID ${eventId} already exists`);
            conflictError.statusCode = 409;
            throw conflictError;
        }
        throw error;
    }
}

/**
 * Get an event by ID
 * @param {string} eventId - The ID of the event to retrieve
 * @returns {Promise<Object>} - The requested event
 */
async function getEvent(eventId) {
    const params = {
        TableName: EVENTS_TABLE,
        Key: { eventId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        const error = new Error(`Event with ID ${eventId} not found`);
        error.statusCode = 404;
        throw error;
    }

    return result.Item;
}

/**
 * List events with optional filtering
 * @param {Object} queryParams - Query parameters for filtering
 * @returns {Promise<Array>} - List of events
 */
async function listEvents(queryParams = {}) {
    // Ensure queryParams is an object even if null is explicitly passed
    const safeQueryParams = queryParams ?? {};
    const { gameId, eventType, limit } = safeQueryParams;

    // If gameId is specified, use the GSI
    if (gameId) {
        const params = {
            TableName: EVENTS_TABLE,
            IndexName: 'GameIndex',
            KeyConditionExpression: 'gameId = :gameId',
            ExpressionAttributeValues: { ':gameId': gameId },
            ScanIndexForward: false // Return newest events first
        };

        // If eventType is also specified, add a filter
        if (eventType) {
            params.FilterExpression = 'eventType = :eventType';
            params.ExpressionAttributeValues[':eventType'] = eventType;
        }

        // Set result limit if specified
        if (limit) {
            params.Limit = parseInt(limit, 10);
        }

        const result = await dynamodb.send(new QueryCommand(params));
        return result.Items;
    }

    // If only eventType is specified, use a scan with filter
    if (eventType) {
        const params = {
            TableName: EVENTS_TABLE,
            FilterExpression: 'eventType = :eventType',
            ExpressionAttributeValues: { ':eventType': eventType }
        };

        // Set result limit if specified
        if (limit) {
            params.Limit = parseInt(limit, 10);
        }

        const result = await dynamodb.send(new ScanCommand(params));
        return result.Items;
    }

    // If no filters, just return recent events
    const params = {
        TableName: EVENTS_TABLE,
        Limit: limit ? parseInt(limit, 10) : 50
    };

    const result = await dynamodb.send(new ScanCommand(params));

    // Sort by creation time (newest first)
    return result.Items.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

/**
 * Update an existing event
 * @param {string} eventId - The ID of the event to update
 * @param {Object} eventData - The updated event data
 * @returns {Promise<Object>} - The updated event
 */
async function updateEvent(eventId, eventData) {
    // First check if the event exists
    await getEvent(eventId);

    // Add updated timestamp
    const timestamp = new Date().toISOString();

    // Create expressions for the update
    const { updateExpression, expressionAttributeValues, expressionAttributeNames } = buildUpdateExpression(
        { ...eventData, updatedAt: timestamp }
    );

    const params = {
        TableName: EVENTS_TABLE,
        Key: { eventId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Delete an event
 * @param {string} eventId - The ID of the event to delete
 * @returns {Promise<void>}
 */
async function deleteEvent(eventId) {
    // First check if the event exists
    await getEvent(eventId);

    const params = {
        TableName: EVENTS_TABLE,
        Key: { eventId }
    };

    await dynamodb.send(new DeleteCommand(params));
}

/**
 * Generate text for an event using templates
 * @param {string|null} eventId - The ID of the existing event, or null for a new event
 * @param {string|null} templateId - Specific template ID to use, or null for default
 * @param {Object|null} eventData - Event data for a new/unsaved event
 * @returns {Promise<Object>} - The generated text and template info
 */
async function generateTextForEvent(eventId, templateId, eventData = null) {
    // If eventId is provided, load the event
    let event;
    if (eventId) {
        event = await getEvent(eventId);
    } else if (eventData) {
        event = eventData;
    } else {
        throw new Error('Either eventId or eventData must be provided');
    }

    // Get game details if needed
    let game;
    if (event.gameId) {
        game = await verifyGameExists(event.gameId);
    }

    // Get template
    let template;
    if (templateId) {
        // Use the specified template
        template = await getTemplate(templateId);
    } else {
        // Find the default template for this event type
        template = await getDefaultTemplateForEventType(event.eventType.toLowerCase());
    }

    if (!template) {
        throw new Error(`No template found for event type: ${event.eventType}`);
    }

    // Prepare variables for template substitution
    const templateVariables = {
        // Player variables
        playerName: event.playerName || '',
        playerNumber: event.playerNumber || '',

        // Team variables
        team: event.teamName || 'Perth Thunder',
        homeTeam: game?.homeTeamName || 'Perth Thunder',
        awayTeam: game?.awayTeamName || '',

        // Score variables
        homeScore: event.homeScore ?? game?.homeScore ?? 0,
        awayScore: event.awayScore ?? game?.awayScore ?? 0,
        scoreStatus: determineScoreStatus(event.homeScore ?? game?.homeScore ?? 0, event.awayScore ?? game?.awayScore ?? 0),

        // Time variables
        timeRemaining: event.gameTime || game?.currentGameTime || '',
        period: getPeriodText(event.period || game?.currentPeriod || 1),
        periodNumber: event.period || game?.currentPeriod || 1,

        // Penalty variables (if applicable)
        penaltyType: event.penaltyType || '',
        penaltyDuration: event.penaltyDuration || '',

        // Location variables
        venue: game?.venue || 'Perth Ice Arena'
    };

    // Fill in template with variables
    const text = fillTemplate(template.text, templateVariables);

    return {
        text,
        templateId: template.templateId,
        templateName: template.name
    };
}

/**
 * Generate text for a manual event (not saved in database)
 * @param {Object} eventData - The event data
 * @returns {Promise<Object>} - The generated text
 */
async function generateTextForManualEvent(eventData) {
    // Validate required fields
    if (!eventData.templateId) {
        throw new Error('Template ID is required');
    }

    // Get the template
    const template = await getTemplate(eventData.templateId);

    if (!template) {
        throw new Error(`Template with ID ${eventData.templateId} not found`);
    }

    // Get game details if provided
    let game;
    if (eventData.gameId) {
        game = await verifyGameExists(eventData.gameId);
    }

    // Prepare variables for template substitution
    const templateVariables = {
        // Player variables
        playerName: eventData.playerName || '',
        playerNumber: eventData.playerNumber || '',

        // Team variables
        team: eventData.teamName || 'Perth Thunder',
        homeTeam: game?.homeTeamName || 'Perth Thunder',
        awayTeam: game?.awayTeamName || '',

        // Score variables
        homeScore: eventData.homeScore ?? game?.homeScore ?? 0,
        awayScore: eventData.awayScore ?? game?.awayScore ?? 0,
        scoreStatus: determineScoreStatus(eventData.homeScore ?? game?.homeScore ?? 0, eventData.awayScore ?? game?.awayScore ?? 0),

        // Time variables
        timeRemaining: eventData.gameTime || game?.currentGameTime || '',
        period: getPeriodText(eventData.period || game?.currentPeriod || 1),
        periodNumber: eventData.period || game?.currentPeriod || 1,

        // Penalty variables (if applicable)
        penaltyType: eventData.penaltyType || '',
        penaltyDuration: eventData.penaltyDuration || '',

        // Location variables
        venue: game?.venue || 'Perth Ice Arena'
    };

    // Fill in custom values from the request
    Object.entries(eventData).forEach(([key, value]) => {
        if (key.startsWith('var_')) {
            const varName = key.replace('var_', '');
            templateVariables[varName] = value;
        }
    });

    // Fill in template with variables
    const text = fillTemplate(template.text, templateVariables);

    return {
        text,
        templateId: template.templateId,
        templateName: template.name
    };
}

/**
 * Fill a template with variable values
 * @param {string} templateText - The template text with variables
 * @param {Object} variables - The variables to substitute
 * @returns {string} - The filled template
 */
function fillTemplate(templateText, variables) {
    let text = templateText;

    // Replace all variables in template with actual values
    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        text = text.replace(regex, value);
    });

    return text;
}

/**
 * Get the default template for an event type
 * @param {string} eventType - The event type
 * @returns {Promise<Object|null>} - The default template or null if none exists
 */
async function getDefaultTemplateForEventType(eventType) {
    const params = {
        TableName: TEMPLATES_TABLE,
        IndexName: 'EventTypeIndex',
        KeyConditionExpression: 'eventType = :eventType',
        ExpressionAttributeValues: { ':eventType': eventType }
    };

    const result = await dynamodb.send(new QueryCommand(params));

    if (result.Items.length === 0) {
        return null;
    }

    // Find the default template
    const defaultTemplate = result.Items.find(template => template.isDefault);

    // If no default is set, use the first one
    return defaultTemplate || result.Items[0];
}

/**
 * Get a template by ID
 * @param {string} templateId - The ID of the template to retrieve
 * @returns {Promise<Object>} - The requested template
 */
async function getTemplate(templateId) {
    const params = {
        TableName: TEMPLATES_TABLE,
        Key: { templateId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        throw new Error(`Template with ID ${templateId} not found`);
    }

    return result.Item;
}

/**
 * Update the score for a game
 * @param {string} gameId - The ID of the game
 * @param {number} homeScore - The new home score
 * @param {number} awayScore - The new away score
 * @returns {Promise<Object>} - The updated game
 */
async function updateGameScore(gameId, homeScore, awayScore) {
    const timestamp = new Date().toISOString();

    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId },
        UpdateExpression: 'SET homeScore = :homeScore, awayScore = :awayScore, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
            ':homeScore': homeScore,
            ':awayScore': awayScore,
            ':updatedAt': timestamp
        },
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));
    return result.Attributes;
}

/**
 * Verify that a game exists
 * @param {string} gameId - The ID of the game to verify
 * @returns {Promise<Object>} - The game object if it exists
 */
async function verifyGameExists(gameId) {
    const params = {
        TableName: GAMES_TABLE,
        Key: { gameId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        throw new Error(`Game with ID ${gameId} not found`);
    }

    return result.Item;
}

/**
 * Verify that a player exists
 * @param {string} playerId - The ID of the player to verify
 * @returns {Promise<Object>} - The player object if it exists
 */
async function verifyPlayerExists(playerId) {
    const params = {
        TableName: PLAYERS_TABLE,
        Key: { playerId }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        throw new Error(`Player with ID ${playerId} not found`);
    }

    return result.Item;
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
 * Determine the score status text (lead, trail, tied)
 * @param {number} homeScore - The home team score
 * @param {number} awayScore - The away team score
 * @returns {string} - The score status text
 */
function determineScoreStatus(homeScore, awayScore) {
    if (homeScore > awayScore) {
        return 'lead';
    } else if (homeScore < awayScore) {
        return 'trail';
    } else {
        return 'tied';
    }
}

/**
 * Get the period text
 * @param {number} periodNumber - The period number
 * @returns {string} - The period text
 */
function getPeriodText(periodNumber) {
    switch (periodNumber) {
        case 1:
            return 'first period';
        case 2:
            return 'second period';
        case 3:
            return 'third period';
        case 4:
            return 'overtime';
        case 5:
            return 'shootout';
        default:
            return `period ${periodNumber}`;
    }
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
        if (key === 'eventId' || value === null || value === undefined) {
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
