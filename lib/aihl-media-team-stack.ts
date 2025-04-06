import * as cdk from 'aws-cdk-lib';
import {Construct} from 'constructs';

// Import all the modular constructs
import {Authentication} from './constructs/authentication';
import {Database} from './constructs/database';
import {Storage} from './constructs/storage';
import {LambdaFunctions} from './constructs/lambda';
import {Api} from './constructs/api';
import {Distribution} from './constructs/distribution';

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
            assetsBucket: storage.assetsBucket
        });

        // Grant permissions to Lambda role
        database.grantTablePermissions(lambdaFunctions.lambdaRole);
        storage.grantAssetsBucketAccess(lambdaFunctions.lambdaRole);

        // Create API Gateway module
        const api = new Api(this, 'Api', {
            userPool: auth.userPool,
            teamLambda: lambdaFunctions.teamLambda,
            playerLambda: lambdaFunctions.playerLambda,
            gameLambda: lambdaFunctions.gameLambda,
            eventLambda: lambdaFunctions.eventLambda,
            templateLambda: lambdaFunctions.templatesLambda,
            statusLambda: lambdaFunctions.statusLambda
        });

        // Create CloudFront Distribution module
        const distribution = new Distribution(this, 'Distribution', {
            websiteBucket: storage.websiteBucket,
            assetsBucket: storage.assetsBucket,
            api: api.api
        });

    }
}
