import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';

// Import all the modular constructs
import {Authentication} from './constructs/authentication';
import {Database} from './constructs/database';
import {Storage} from './constructs/storage';
import {LambdaFunctions} from './constructs/lambda';
import {Api} from './constructs/api';
import {Distribution} from './constructs/distribution';
import {AIHLMediaRestApi} from "./configs/api.config";

export class AIHLMediaTeamStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create Authentication module (Cognito)
        const auth = new Authentication(this, 'Authentication');

        // Create Database module (DynamoDB)
        const database = new Database(this, 'Database');

        // Create Storage module (S3)
        const storage = new Storage(this, 'Storage');

        // Create Lambda Functions module
        const lambdaFunctions = new LambdaFunctions(this, 'LambdaFunctions', {
            userPool: auth.userPool,
            appClient: auth.appClient,
            teamsTable: database.teamsTable,
            playersTable: database.playersTable,
            gamesTable: database.gamesTable,
            eventsTable: database.eventsTable,
            templatesTable: database.templatesTable,
            templatesCategoryTable: database.templatesCategoryTable,
            templateVariablesTable: database.templateVariablesTable,
            assetsBucket: storage.assetsBucket
        });

        // Grant permissions to Lambda role
        database.grantTablePermissions(lambdaFunctions.lambdaRole);
        database.grantTablePermissions(lambdaFunctions.templatesLambdaRole);
        storage.grantAssetsBucketAccess(lambdaFunctions.lambdaRole);

        // Create API Gateway module
        const api = new Api(this, 'Api', {
            userPool: auth.userPool,
            lambdas: {
                team: lambdaFunctions.teamLambda,
                player: lambdaFunctions.playerLambda,
                game: lambdaFunctions.gameLambda,
                event: lambdaFunctions.eventLambda,
                template: lambdaFunctions.templatesLambda,
                status: lambdaFunctions.statusLambda
            },
            apiConfig: AIHLMediaRestApi
        });

        // Create CloudFront Distribution module
        new Distribution(this, 'Distribution', {
            websiteBucket: storage.websiteBucket,
            assetsBucket: storage.assetsBucket,
            api: api.api
        });

    }
}
