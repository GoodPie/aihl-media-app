/**
 * Build an update expression for DynamoDB from an object
 * @param {Object} updateData - The data to update
 * @returns {Object} - The update expression, attribute values, and attribute names
 */
export function buildUpdateExpression(updateData) {
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