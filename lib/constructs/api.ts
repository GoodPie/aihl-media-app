/**
 * Import necessary AWS CDK libraries
 */
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import {Construct} from 'constructs';
import {IRestApiConfig} from '@apiTypes/RestApiConfig';
import {ResourceConfig} from "../configs/api.config";
import {IResourceName} from "@apiTypes/resourceName";

/**
 * Properties for the Api construct
 * @interface ApiProps
 * @property {cognito.UserPool} userPool - Cognito user pool for API authorization
 * @property {Object} lambdas - Lambda functions for handling various resource endpoints
 * @property {lambda.Function} lambdas.team - Lambda function for team resources
 * @property {lambda.Function} lambdas.player - Lambda function for player resources
 * @property {lambda.Function} lambdas.game - Lambda function for game resources
 * @property {lambda.Function} lambdas.event - Lambda function for event resources
 * @property {lambda.Function} lambdas.template - Lambda function for template resources
 * @property {lambda.Function} lambdas.status - Lambda function for status endpoint
 * @property {IRestApiConfig} apiConfig - Configuration for the REST API
 */
export interface ApiProps {
    userPool: cognito.UserPool;
    lambdas: {
        team: lambda.Function;
        player: lambda.Function;
        game: lambda.Function;
        event: lambda.Function;
        template: lambda.Function;
        status: lambda.Function;
    };
    apiConfig: IRestApiConfig;
}

/**
 * A CDK construct that creates an API Gateway REST API with various endpoints and resources
 * for the AIHL Media game day management application.
 */
export class Api extends Construct {
    /**
     * The created API Gateway REST API
     */
    public readonly api: apigateway.RestApi;

    /**
     * The Cognito authorizer used to secure API endpoints
     */
    public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

    /**
     * Request validator for validating API requests
     */
    private readonly validator: apigateway.RequestValidator;

    /**
     * Creates a new API Gateway REST API with configured resources and endpoints
     *
     * @param {Construct} scope - The parent construct
     * @param {string} id - The construct ID
     * @param {ApiProps} props - Configuration properties for the API
     */
    constructor(scope: Construct, id: string, props: ApiProps) {
        super(scope, id);

        // Create core API components
        this.api = this.createApiGateway(props.apiConfig);
        this.authorizer = this.createAuthorizer(props.userPool);
        this.validator = this.createRequestValidator();
        this.setupApiKeyAndUsagePlan();

        // Create API resources
        this.createTeamResources(props.lambdas.team);
        this.createPlayerResources(props.lambdas.player);
        this.createGameResources(props.lambdas.game);
        this.createEventResources(props.lambdas.event);
        this.createTemplateResources(props.lambdas.template);
        this.createCategoryResources(props.lambdas.template);
        this.createStatusResource(props.lambdas.status);

        // Add output
        this.addOutputs();
    }

    /**
     * Creates and configures the API Gateway REST API
     *
     * @param {IRestApiConfig} config - Configuration for the REST API
     * @returns {apigateway.RestApi} The created API Gateway REST API
     * @private
     */
    private createApiGateway(config: IRestApiConfig): apigateway.RestApi {
        try {
            return new apigateway.RestApi(this, config.id, {
                restApiName: config.name,
                description: config.description,
                defaultCorsPreflightOptions: {
                    allowOrigins: config.allowOrigins ?? apigateway.Cors.ALL_ORIGINS,
                    allowMethods: config.allowMethods ?? apigateway.Cors.ALL_METHODS,
                    allowCredentials: config.allowCredentials ?? true,
                    allowHeaders: config.allowHeaders ?? ['Authorization', 'Content-Type', '*']
                },
                deployOptions: {
                    stageName: config.environment ?? 'prod',
                    loggingLevel: apigateway.MethodLoggingLevel.INFO,
                    dataTraceEnabled: true,
                    metricsEnabled: true
                }
            });
        } catch (e) {
            console.error('Error creating API Gateway:', e);
            throw e;
        }
    }

    /**
     * Creates a Cognito user pool authorizer for the API
     *
     * @param {cognito.UserPool} userPool - The Cognito user pool to use for authorization
     * @returns {apigateway.CognitoUserPoolsAuthorizer} The created authorizer
     * @private
     */
    private createAuthorizer(userPool: cognito.UserPool): apigateway.CognitoUserPoolsAuthorizer {
        return new apigateway.CognitoUserPoolsAuthorizer(this, 'AIHLMediaAuthoriser', {
            cognitoUserPools: [userPool]
        });
    }

    /**
     * Creates a request validator for the API
     *
     * @returns {apigateway.RequestValidator} The created request validator
     * @private
     */
    private createRequestValidator(): apigateway.RequestValidator {
        return this.api.addRequestValidator('RequestValidator', {
            validateRequestBody: true,
            validateRequestParameters: true
        });
    }

    /**
     * Sets up API key and usage plan for rate limiting and quota management
     *
     * @private
     */
    private setupApiKeyAndUsagePlan(): void {
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
    }

    /**
     * Creates a resource with standard CRUD methods (GET, POST, GET by ID, PUT, DELETE)
     *
     * @param {apigateway.IResource} parentResource - The parent resource to attach to
     * @param {IResourceName} resourceName - The resource name configuration
     * @param {lambda.Function} lambdaFunction - The Lambda function to handle requests
     * @param {boolean} requiresAuth - Whether authentication is required (default: true)
     * @returns {apigateway.Resource} The created collection resource
     * @private
     */
    private createResourceWithCrudMethods(
        parentResource: apigateway.IResource,
        resourceName: IResourceName,
        lambdaFunction: lambda.Function,
        requiresAuth: boolean = true
    ): apigateway.Resource {
        const resource = parentResource.addResource(resourceName.collection);

        // Collection endpoints (GET, POST)
        this.addMethod(resource, 'GET', lambdaFunction, requiresAuth);
        this.addMethod(resource, 'POST', lambdaFunction, requiresAuth);

        // Single item resource
        const singleResource = resource.addResource(`{${resourceName.item}Id}`);

        // Single item endpoints (GET, PUT, DELETE)
        this.addMethod(singleResource, 'GET', lambdaFunction, requiresAuth);
        this.addMethod(singleResource, 'PUT', lambdaFunction, requiresAuth);
        this.addMethod(singleResource, 'DELETE', lambdaFunction, requiresAuth);

        return resource;
    }

    /**
     * Adds an HTTP method to a resource with specified Lambda integration
     *
     * @param {apigateway.IResource} resource - The resource to add the method to
     * @param {string} httpMethod - The HTTP method (GET, POST, PUT, DELETE)
     * @param {lambda.Function} lambdaFunction - The Lambda function to integrate with
     * @param {boolean} requiresAuth - Whether authentication is required (default: true)
     * @returns {apigateway.Method} The created method
     * @private
     */
    private addMethod(
        resource: apigateway.IResource,
        httpMethod: string,
        lambdaFunction: lambda.Function,
        requiresAuth: boolean = true
    ): apigateway.Method {
        const integration = new apigateway.LambdaIntegration(lambdaFunction);
        const methodOptions: apigateway.MethodOptions = requiresAuth ? {
            authorizer: this.authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
            requestValidator: this.validator,
        } : {};

        return resource.addMethod(httpMethod, integration, methodOptions);
    }

    /**
     * Creates team-related API resources
     *
     * @param {lambda.Function} lambda - The Lambda function to handle team requests
     * @private
     */
    private createTeamResources(lambda: lambda.Function): void {
        this.createResourceWithCrudMethods(
            this.api.root,
            ResourceConfig.team,
            lambda
        );
    }

    /**
     * Creates player-related API resources
     *
     * @param {lambda.Function} lambda - The Lambda function to handle player requests
     * @private
     */
    private createPlayerResources(lambda: lambda.Function): void {
        this.createResourceWithCrudMethods(
            this.api.root,
            ResourceConfig.player,
            lambda
        );
    }

    /**
     * Creates game-related API resources
     *
     * @param {lambda.Function} lambda - The Lambda function to handle game requests
     * @private
     */
    private createGameResources(lambda: lambda.Function): void {
        this.createResourceWithCrudMethods(
            this.api.root,
            ResourceConfig.game,
            lambda
        );
    }

    /**
     * Creates event-related API resources
     *
     * @param {lambda.Function} lambda - The Lambda function to handle event requests
     * @private
     */
    private createEventResources(lambda: lambda.Function): void {
        this.createResourceWithCrudMethods(
            this.api.root,
            ResourceConfig.event,
            lambda
        );
    }

    /**
     * Creates template-related API resources
     *
     * @param {lambda.Function} lambda - The Lambda function to handle template requests
     * @private
     */
    private createTemplateResources(lambda: lambda.Function): void {
        this.createResourceWithCrudMethods(
            this.api.root,
            ResourceConfig.template,
            lambda
        );
    }

    /**
     * Creates category-related API resources with special authentication requirements:
     * GET is public, other methods require authentication
     *
     * @param {lambda.Function} lambda - The Lambda function to handle category requests
     * @private
     */
    private createCategoryResources(lambda: lambda.Function): void {
        const categoriesResource = this.api.root.addResource(ResourceConfig.category.collection);
        // Public GET, but authenticated POST
        this.addMethod(categoriesResource, 'GET', lambda, false);
        this.addMethod(categoriesResource, 'POST', lambda, true);

        const categoryResource = categoriesResource.addResource(`{${ResourceConfig.category.item}Id}`);
        this.addMethod(categoryResource, 'GET', lambda, true);
        this.addMethod(categoryResource, 'PUT', lambda, true);
        this.addMethod(categoryResource, 'DELETE', lambda, true);
    }

    /**
     * Creates a public status endpoint for health checks and service information
     *
     * @param {lambda.Function} lambda - The Lambda function to handle status requests
     * @private
     */
    private createStatusResource(lambda: lambda.Function): void {
        const statusResource = this.api.root.addResource(ResourceConfig.status.collection);
        this.addMethod(statusResource, 'GET', lambda, false);
    }

    /**
     * Adds CloudFormation outputs for the API URL
     *
     * @private
     */
    private addOutputs(): void {
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: this.api.url,
            description: 'The URL of the API Gateway'
        });
    }
}
