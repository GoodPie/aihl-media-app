import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(client);

// Get table names from environment variables
const TEMPLATES_TABLE = process.env.TEMPLATES_TABLE || 'Templates';
const TEMPLATE_CATEGORIES_TABLE = 'TemplateCategories';
const TEMPLATE_VARIABLES_TABLE = 'TemplateVariables';

// Define CORS headers
const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With'
};

/**
 * Main handler for Templates Lambda function
 */
export const handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Handle OPTIONS method for CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    // Parse path to determine operation
    const pathSegments = event.path.split('/');
    const resource = pathSegments[1]; // 'categories' or 'templates'
    const resourceId = pathSegments[2]; // categoryId or templateId if present

    // Parse request body if present
    const requestBody = event.body ? JSON.parse(event.body) : {};

    try {
        // Route to appropriate handler based on HTTP method and path
        if (resource === 'categories') {
            if (event.httpMethod === 'GET' && !resourceId) {
                // GET /categories - List all categories
                return await listCategories();
            } else if (event.httpMethod === 'GET' && resourceId) {
                // GET /categories/{categoryId} - Get a specific category
                return await getCategory(resourceId);
            } else if (event.httpMethod === 'POST') {
                // POST /categories - Create a new category
                return await createCategory(requestBody);
            } else if (event.httpMethod === 'PUT' && resourceId) {
                // PUT /categories/{categoryId} - Update a category
                return await updateCategory(resourceId, requestBody);
            } else if (event.httpMethod === 'DELETE' && resourceId) {
                // DELETE /categories/{categoryId} - Delete a category
                return await deleteCategory(resourceId);
            }
        } else if (resource === 'templates') {
            if (event.httpMethod === 'GET' && !resourceId) {
                // GET /templates - List all templates
                return await listTemplates(requestBody.categoryId);
            } else if (event.httpMethod === 'GET' && resourceId) {
                // GET /templates/{templateId} - Get a specific template
                return await getTemplate(resourceId);
            } else if (event.httpMethod === 'POST') {
                // POST /templates - Create a new template
                return await createTemplate(requestBody);
            } else if (event.httpMethod === 'PUT' && resourceId) {
                // PUT /templates/{templateId} - Update a template
                return await updateTemplate(resourceId, requestBody);
            } else if (event.httpMethod === 'DELETE' && resourceId) {
                // DELETE /templates/{templateId} - Delete a template
                return await deleteTemplate(resourceId);
            } else if (event.httpMethod === 'PUT' && resourceId && pathSegments[3] === 'default') {
                // PUT /templates/{templateId}/default - Set template as default for its category
                return await setDefaultTemplate(resourceId);
            }
        } else if (resource === 'variables') {
            if (event.httpMethod === 'GET') {
                // GET /variables - List all template variables
                return await listVariables(requestBody.category);
            }
        }

        // If no handler matched, return 404
        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Not Found' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Internal Server Error', error: error.message })
        };
    }
};

// ================= CATEGORY HANDLERS =================

async function listCategories() {
    const params = {
        TableName: TEMPLATE_CATEGORIES_TABLE
    };

    const result = await dynamodb.send(new ScanCommand(params));

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Items)
    };
}

async function getCategory(categoryId) {
    const params = {
        TableName: TEMPLATE_CATEGORIES_TABLE,
        Key: {
            categoryId: categoryId
        }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Category not found' })
        };
    }

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Item)
    };
}

async function createCategory(category) {
    // Add timestamps
    const now = new Date().toISOString();
    category.createdAt = now;
    category.updatedAt = now;

    const params = {
        TableName: TEMPLATE_CATEGORIES_TABLE,
        Item: category,
        ConditionExpression: 'attribute_not_exists(categoryId)'
    };

    await dynamodb.send(new PutCommand(params));

    return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(category)
    };
}

async function updateCategory(categoryId, updates) {
    // Update timestamp
    updates.updatedAt = new Date().toISOString();

    // Build update expression
    let updateExpression = 'SET ';
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.keys(updates).forEach((key, index) => {
        const valueKey = `:val${index}`;
        const nameKey = `#attr${index}`;
        updateExpression += index === 0 ? '' : ', ';
        updateExpression += `${nameKey} = ${valueKey}`;
        expressionAttributeValues[valueKey] = updates[key];
        expressionAttributeNames[nameKey] = key;
    });

    const params = {
        TableName: TEMPLATE_CATEGORIES_TABLE,
        Key: {
            categoryId: categoryId
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Attributes)
    };
}

async function deleteCategory(categoryId) {
    const params = {
        TableName: TEMPLATE_CATEGORIES_TABLE,
        Key: {
            categoryId: categoryId
        }
    };

    await dynamodb.send(new DeleteCommand(params));

    return {
        statusCode: 204,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Category deleted successfully' })
    };
}

// ================= TEMPLATE HANDLERS =================

async function listTemplates(categoryId) {
    let params;

    if (categoryId) {
        params = {
            TableName: TEMPLATES_TABLE,
            IndexName: 'CategoryIndex',
            KeyConditionExpression: 'categoryId = :categoryId',
            ExpressionAttributeValues: {
                ':categoryId': categoryId
            }
        };

        const result = await dynamodb.send(new QueryCommand(params));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(result.Items)
        };
    } else {
        params = {
            TableName: TEMPLATES_TABLE
        };

        const result = await dynamodb.send(new ScanCommand(params));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(result.Items)
        };
    }
}

async function getTemplate(templateId) {
    const params = {
        TableName: TEMPLATES_TABLE,
        Key: {
            templateId: templateId
        }
    };

    const result = await dynamodb.send(new GetCommand(params));

    if (!result.Item) {
        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Template not found' })
        };
    }

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Item)
    };
}

async function createTemplate(template) {
    // Generate a unique ID if one is not provided
    if (!template.templateId) {
        template.templateId = `${template.categoryId}-${Date.now()}`;
    }

    // Add timestamps
    const now = new Date().toISOString();
    template.createdAt = now;
    template.updatedAt = now;

    const params = {
        TableName: TEMPLATES_TABLE,
        Item: template
    };

    await dynamodb.send(new PutCommand(params));

    return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify(template)
    };
}

async function updateTemplate(templateId, updates) {
    // Update timestamp
    updates.updatedAt = new Date().toISOString();

    // Build update expression
    let updateExpression = 'SET ';
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.keys(updates).forEach((key, index) => {
        const valueKey = `:val${index}`;
        const nameKey = `#attr${index}`;
        updateExpression += index === 0 ? '' : ', ';
        updateExpression += `${nameKey} = ${valueKey}`;
        expressionAttributeValues[valueKey] = updates[key];
        expressionAttributeNames[nameKey] = key;
    });

    const params = {
        TableName: TEMPLATES_TABLE,
        Key: {
            templateId: templateId
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        ReturnValues: 'ALL_NEW'
    };

    const result = await dynamodb.send(new UpdateCommand(params));

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Attributes)
    };
}

async function deleteTemplate(templateId) {
    const params = {
        TableName: TEMPLATES_TABLE,
        Key: {
            templateId: templateId
        }
    };

    await dynamodb.send(new DeleteCommand(params));

    return {
        statusCode: 204,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Template deleted successfully' })
    };
}

async function setDefaultTemplate(templateId) {
    // First, get the template to determine its category
    const getParams = {
        TableName: TEMPLATES_TABLE,
        Key: {
            templateId: templateId
        }
    };

    const templateResult = await dynamodb.send(new GetCommand(getParams));

    if (!templateResult.Item) {
        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Template not found' })
        };
    }

    const template = templateResult.Item;
    const categoryId = template.categoryId;

    // Find all templates in the same category and set isDefault to false
    const queryParams = {
        TableName: TEMPLATES_TABLE,
        IndexName: 'CategoryIndex',
        KeyConditionExpression: 'categoryId = :categoryId',
        ExpressionAttributeValues: {
            ':categoryId': categoryId
        }
    };

    const categoryTemplates = await dynamodb.send(new QueryCommand(queryParams));

    // Update each template in the category
    const updatePromises = categoryTemplates.Items.map(item => {
        const updateParams = {
            TableName: TEMPLATES_TABLE,
            Key: {
                templateId: item.templateId
            },
            UpdateExpression: 'SET isDefault = :isDefault, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':isDefault': item.templateId === templateId,
                ':updatedAt': new Date().toISOString()
            }
        };

        return dynamodb.send(new UpdateCommand(updateParams));
    });

    await Promise.all(updatePromises);

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            message: `Template ${templateId} set as default for category ${categoryId}`
        })
    };
}

// ================= VARIABLE HANDLERS =================

async function listVariables(category) {
    let params;

    if (category) {
        params = {
            TableName: TEMPLATE_VARIABLES_TABLE,
            IndexName: 'CategoryIndex',
            KeyConditionExpression: 'category = :category',
            ExpressionAttributeValues: {
                ':category': category
            }
        };

        const result = await dynamodb.send(new QueryCommand(params));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(result.Items)
        };
    } else {
        params = {
            TableName: TEMPLATE_VARIABLES_TABLE
        };

        const result = await dynamodb.send(new ScanCommand(params));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(result.Items)
        };
    }
}
