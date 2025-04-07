import { v4 as uuidv4 } from 'uuid';
import { getTeam, createTeamInDB, updateTeamInDB, deleteTeamFromDB } from './db.mjs';
import { buildUpdateExpression } from './utils.mjs';

/**
 * Create a new team
 * @param {Object} teamData - The team data
 * @returns {Promise<Object>} - The created team
 */
export async function createTeam(teamData) {
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
    if (!team.name) {
        const error = new Error('Team name is required');
        error.statusCode = 400;
        throw error;
    }

    return await createTeamInDB(team);
}

/**
 * Update an existing team
 * @param {string} teamId - The ID of the team to update
 * @param {Object} teamData - The updated team data
 * @returns {Promise<Object>} - The updated team
 */
export async function updateTeam(teamId, teamData) {
    // First check if the team exists
    await getTeam(teamId);

    // Add updated timestamp
    const timestamp = new Date().toISOString();

    // Create expressions for the update
    const { updateExpression, expressionAttributeValues, expressionAttributeNames } = buildUpdateExpression(
        { ...teamData, updatedAt: timestamp }
    );

    return await updateTeamInDB(teamId, updateExpression, expressionAttributeValues, expressionAttributeNames);
}

/**
 * Delete a team
 * @param {string} teamId - The ID of the team to delete
 * @returns {Promise<void>}
 */
export async function deleteTeam(teamId) {
    // First check if the team exists
    await getTeam(teamId);
    await deleteTeamFromDB(teamId);
}
