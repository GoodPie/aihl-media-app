import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface ApiProps {
  userPool: cognito.UserPool;
  teamLambda: lambda.Function;
  playerLambda: lambda.Function;
  gameLambda: lambda.Function;
  eventLambda: lambda.Function;
}

export class Api extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props: ApiProps) {
    super(scope, id);

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'PerthThunderApi', {
      restApiName: 'Perth Thunder Game Day API',
      description: 'API for Perth Thunder game day management',
      defaultCorsPreflightOptions: {
        allowOrigins: ['http://localhost:3000'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowHeaders: ['Authorization', 'Content-Type']
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
    this.authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'PerthThunderAuthorizer', {
      cognitoUserPools: [props.userPool]
    });

    // Create API Resources
    const teamsResource = this.api.root.addResource('teams');
    const playersResource = this.api.root.addResource('players');
    const gamesResource = this.api.root.addResource('games');
    const eventsResource = this.api.root.addResource('events');
    const templatesResource = this.api.root.addResource('templates');

    // Teams endpoints
    teamsResource.addMethod('GET', new apigateway.LambdaIntegration(props.teamLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    teamsResource.addMethod('POST', new apigateway.LambdaIntegration(props.teamLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });

    const teamResource = teamsResource.addResource('{teamId}');
    teamResource.addMethod('GET', new apigateway.LambdaIntegration(props.teamLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    teamResource.addMethod('PUT', new apigateway.LambdaIntegration(props.teamLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    teamResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.teamLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });

    // Player endpoints
    playersResource.addMethod('GET', new apigateway.LambdaIntegration(props.playerLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    playersResource.addMethod('POST', new apigateway.LambdaIntegration(props.playerLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    const playerResource = playersResource.addResource('{playerId}');
    playerResource.addMethod('GET', new apigateway.LambdaIntegration(props.playerLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    playerResource.addMethod('PUT', new apigateway.LambdaIntegration(props.playerLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    playerResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.playerLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });

    // Game endpoints
    gamesResource.addMethod('GET', new apigateway.LambdaIntegration(props.gameLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    gamesResource.addMethod('POST', new apigateway.LambdaIntegration(props.gameLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    const gameResource = gamesResource.addResource('{gameId}');
    gameResource.addMethod('GET', new apigateway.LambdaIntegration(props.gameLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    gameResource.addMethod('PUT', new apigateway.LambdaIntegration(props.gameLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    gameResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.gameLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });

    // Event endpoints
    eventsResource.addMethod('GET', new apigateway.LambdaIntegration(props.eventLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    eventsResource.addMethod('POST', new apigateway.LambdaIntegration(props.eventLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    const eventResource = eventsResource.addResource('{eventId}');
    eventResource.addMethod('GET', new apigateway.LambdaIntegration(props.eventLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    eventResource.addMethod('PUT', new apigateway.LambdaIntegration(props.eventLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    eventResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.eventLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });

    // Template endpoints
    templatesResource.addMethod('GET', new apigateway.LambdaIntegration(props.eventLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    templatesResource.addMethod('POST', new apigateway.LambdaIntegration(props.eventLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    const templateResource = templatesResource.addResource('{templateId}');
    templateResource.addMethod('GET', new apigateway.LambdaIntegration(props.eventLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    templateResource.addMethod('PUT', new apigateway.LambdaIntegration(props.eventLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });
    templateResource.addMethod('DELETE', new apigateway.LambdaIntegration(props.eventLambda), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO
    });

    // Add output
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'The URL of the API Gateway'
    });
  }
}
