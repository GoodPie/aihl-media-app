/**
 * Main handler for Status Lambda function
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
            'Access-Control-Allow-Methods': 'GET,OPTIONS',
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
        const { httpMethod } = event;

        // Route to the appropriate handler based on HTTP method
        switch (httpMethod) {
            case 'GET':
                // Return API status
                response.body = JSON.stringify(getStatus());
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
 * Get API status information
 * @returns {Object} - Status information
 */
function getStatus() {
    const timestamp = new Date().toISOString();
    
    return {
        status: 'operational',
        version: '1.0.0',
        timestamp: timestamp,
        environment: process.env.NODE_ENV || 'production',
        message: 'AIHL Game Day API is running'
    };
}