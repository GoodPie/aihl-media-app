import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import {Construct} from 'constructs';

export interface ApiProps {
    userPool: cognito.UserPool;
    teamLambda: lambda.Function;
    playerLambda: lambda.Function;
    gameLambda: lambda.Function;
    eventLambda: lambda.Function;
    templateLambda: lambda.Function;
    statusLambda: lambda.Function;
}

export class Api extends Construct {
    public readonly api: apigateway.RestApi;
    public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

    constructor(scope: Construct, id: string, props: ApiProps) {
        super(scope, id);

        // Create API Gateway
        this.api = new apigateway.RestApi(this, 'aihl-media-day-api', {
            restApiName: 'AIHL Game Day API',
            description: 'API for AIHL Media game day management',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowCredentials: true,
                allowHeaders: ['Authorization', 'Content-Type', '*']
            },
            deployOptions: {
                stageName: 'prod',
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                metricsEnabled: true
            }
        });

        // Add API key and usage plan for rate limiting
        const apiKey = this.api.addApiKey('ApiKey');
        const plan = this.api.addUsagePlan('UsagePlan', {
            throttle: {
                rateLimit: 10,
                burstLimit: 20
            },
            quota: {
                limit: 1000,
                period: apigateway.Period.DAY
            }
        });
        plan.addApiKey(apiKey);

        // Add request validator
        const validator = this.api.addRequestValidator('RequestValidator', {
            validateRequestBody: true,
            validateRequestParameters: true
        });

        // Create Cognito Authorizer
        this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'AIHLMediaAuthoriser', {
            cognitoUserPools: [props.userPool]
        });

        // Create API Resources
        const teamsResource = this.api.root.addResource('teams');
        const playersResource = this.api.root.addResource('players');
        const gamesResource = this.api.root.addResource('games');
        const eventsResource = this.api.root.addResource('events');
        const templatesResource = this.api.root.addResource('templates');
        const categoriesResource = this.api.root.addResource('categories');
        const statusResource = this.api.root.addResource('status');

        // Teams endpoints
        teamsResource.addMethod('GET', new apigateway.LambdaIntegration(props.teamLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        teamsResource.addMethod('POST', new apigateway.LambdaIntegration(props.teamLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });

        const teamResource = teamsResource.addResource('{teamId}');
        teamResource.addMethod('GET', new apigateway.LambdaIntegration(props.teamLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        teamResource.addMethod('PUT', new apigateway.LambdaIntegration(props.teamLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        teamResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.teamLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });

        // Player endpoints
        playersResource.addMethod('GET', new apigateway.LambdaIntegration(props.playerLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        playersResource.addMethod('POST', new apigateway.LambdaIntegration(props.playerLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        const playerResource = playersResource.addResource('{playerId}');
        playerResource.addMethod('GET', new apigateway.LambdaIntegration(props.playerLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        playerResource.addMethod('PUT', new apigateway.LambdaIntegration(props.playerLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        playerResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.playerLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });

        // Game endpoints
        gamesResource.addMethod('GET', new apigateway.LambdaIntegration(props.gameLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        gamesResource.addMethod('POST', new apigateway.LambdaIntegration(props.gameLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        const gameResource = gamesResource.addResource('{gameId}');
        gameResource.addMethod('GET', new apigateway.LambdaIntegration(props.gameLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        gameResource.addMethod('PUT', new apigateway.LambdaIntegration(props.gameLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        gameResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.gameLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });

        // Event endpoints
        eventsResource.addMethod('GET', new apigateway.LambdaIntegration(props.eventLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        eventsResource.addMethod('POST', new apigateway.LambdaIntegration(props.eventLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        const eventResource = eventsResource.addResource('{eventId}');
        eventResource.addMethod('GET', new apigateway.LambdaIntegration(props.eventLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        eventResource.addMethod('PUT', new apigateway.LambdaIntegration(props.eventLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        eventResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.eventLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator
        });

        // Template endpoints
        templatesResource.addMethod('GET', new apigateway.LambdaIntegration(props.templateLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        templatesResource.addMethod('POST', new apigateway.LambdaIntegration(props.templateLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        const templateResource = templatesResource.addResource('{templateId}');
        templateResource.addMethod('GET', new apigateway.LambdaIntegration(props.templateLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        templateResource.addMethod('PUT', new apigateway.LambdaIntegration(props.templateLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        templateResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.templateLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });

        // Categories endpoints
        categoriesResource.addMethod('GET', new apigateway.LambdaIntegration(props.templateLambda));
        categoriesResource.addMethod('POST', new apigateway.LambdaIntegration(props.templateLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        const categoryResource = categoriesResource.addResource('{categoryId}');
        categoryResource.addMethod('GET', new apigateway.LambdaIntegration(props.templateLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        categoryResource.addMethod('PUT', new apigateway.LambdaIntegration(props.templateLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });
        categoryResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.templateLambda), {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: validator,
        });

        // Status endpoint - publicly accessible without authentication
        statusResource.addMethod('GET', new apigateway.LambdaIntegration(props.statusLambda));

        // Add output
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: this.api.url,
            description: 'The URL of the API Gateway'
        });
    }
}
