import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {Construct} from 'constructs';

export interface LambdaProps {
    userPool: cognito.UserPool;
    appClient: cognito.UserPoolClient;
    teamsTable: dynamodb.Table;
    playersTable: dynamodb.Table;
    gamesTable: dynamodb.Table;
    eventsTable: dynamodb.Table;
    templatesTable: dynamodb.Table;
    assetsBucket: s3.Bucket;
}

export class LambdaFunctions extends Construct {
    public readonly lambdaRole: iam.Role; // Keeping for backward compatibility
    public readonly teamLambdaRole: iam.Role;
    public readonly playerLambdaRole: iam.Role;
    public readonly gameLambdaRole: iam.Role;
    public readonly eventLambdaRole: iam.Role;
    public readonly templatesLambdaRole: iam.Role;
    public readonly statusLambdaRole: iam.Role;
    public readonly teamLambda: lambda.Function;
    public readonly playerLambda: lambda.Function;
    public readonly gameLambda: lambda.Function;
    public readonly eventLambda: lambda.Function;
    public readonly templatesLambda: lambda.Function;
    public readonly statusLambda: lambda.Function;
    public readonly lambdaEnv: { [key: string]: string };

    private readonly lambdaPolicies = new iam.PolicyStatement({
        actions: [
            'ec2:CreateNetworkInterface',
            'ec2:DescribeNetworkInterfaces',
            'ec2:DeleteNetworkInterface',
            'ec2:AssignPrivateIpAddresses',
            'ec2:UnassignPrivateIpAddresses'
        ], resources: ['*']
    });

    constructor(scope: Construct, id: string, props: LambdaProps) {
        super(scope, id);

        // Create VPC for Lambda functions
        const vpc = new ec2.Vpc(this, 'LambdaVpc', {
            maxAzs: 2,
            natGateways: 1
        });

        // Create encryption key for environment variables
        const envVarKey = new kms.Key(this, 'EnvVarKey', {
            enableKeyRotation: true
        });

        // Create Lambda execution role (keeping for backward compatibility)
        this.lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        this.lambdaRole.addToPolicy(this.lambdaPolicies);

        // Create separate roles for each Lambda function
        this.teamLambdaRole = new iam.Role(this, 'TeamLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        this.teamLambdaRole.addToPolicy(this.lambdaPolicies);

        this.playerLambdaRole = new iam.Role(this, 'PlayerLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        this.playerLambdaRole.addToPolicy(this.lambdaPolicies);

        this.gameLambdaRole = new iam.Role(this, 'GameLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        this.gameLambdaRole.addToPolicy(this.lambdaPolicies);

        this.eventLambdaRole = new iam.Role(this, 'EventLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        this.eventLambdaRole.addToPolicy(this.lambdaPolicies);

        // Create templates Lambda role
        this.templatesLambdaRole = new iam.Role(this, 'TemplatesLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        this.templatesLambdaRole.addToPolicy(this.lambdaPolicies);

        // Create status Lambda role
        this.statusLambdaRole = new iam.Role(this, 'StatusLambdaRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
            ]
        });
        this.statusLambdaRole.addToPolicy(this.lambdaPolicies);

        // Grant specific permissions to each role
        props.teamsTable.grantReadData(this.teamLambdaRole);
        props.teamsTable.grant(this.teamLambdaRole, 'dynamodb:PutItem', 'dynamodb:UpdateItem');

        props.teamsTable.grantReadData(this.playerLambdaRole);
        props.playersTable.grantReadData(this.playerLambdaRole);
        props.playersTable.grant(this.playerLambdaRole, 'dynamodb:PutItem', 'dynamodb:UpdateItem');

        props.gamesTable.grantReadData(this.gameLambdaRole);
        props.gamesTable.grant(this.gameLambdaRole, 'dynamodb:PutItem', 'dynamodb:UpdateItem');
        props.gamesTable.grantReadData(this.teamLambdaRole);

        props.eventsTable.grantReadData(this.eventLambdaRole);
        props.eventsTable.grant(this.eventLambdaRole, 'dynamodb:PutItem', 'dynamodb:UpdateItem');
        props.templatesTable.grantReadData(this.eventLambdaRole);

        // Grant permissions to templates Lambda role
        props.templatesTable.grantReadData(this.templatesLambdaRole);
        props.templatesTable.grant(this.templatesLambdaRole, 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Scan', 'dynamodb:Query');

        // Grant asset bucket access to all roles
        props.assetsBucket.grantRead(this.teamLambdaRole);
        props.assetsBucket.grantRead(this.playerLambdaRole);
        props.assetsBucket.grantRead(this.gameLambdaRole);
        props.assetsBucket.grantRead(this.eventLambdaRole);
        props.assetsBucket.grantRead(this.templatesLambdaRole);

        // Common Lambda environment variables
        this.lambdaEnv = {
            TEAMS_TABLE: props.teamsTable.tableName,
            PLAYERS_TABLE: props.playersTable.tableName,
            GAMES_TABLE: props.gamesTable.tableName,
            EVENTS_TABLE: props.eventsTable.tableName,
            TEMPLATES_TABLE: props.templatesTable.tableName,
            ASSETS_BUCKET: props.assetsBucket.bucketName,
            USER_POOL_ID: props.userPool.userPoolId,
            CLIENT_ID: props.appClient.userPoolClientId
        };

        // Team Management Lambda
        this.teamLambda = new lambda.Function(this, 'TeamFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/teams'),
            environment: this.lambdaEnv,
            environmentEncryption: envVarKey,
            role: this.teamLambdaRole,
            vpc: vpc,
            tracing: lambda.Tracing.ACTIVE,
            logRetention: logs.RetentionDays.ONE_WEEK,
            timeout: cdk.Duration.seconds(10),
        });

        // Player Management Lambda
        this.playerLambda = new lambda.Function(this, 'PlayerFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/players'),
            environment: this.lambdaEnv,
            environmentEncryption: envVarKey,
            role: this.playerLambdaRole,
            vpc: vpc,
            tracing: lambda.Tracing.ACTIVE,
            logRetention: logs.RetentionDays.ONE_WEEK,
            timeout: cdk.Duration.seconds(10),
        });

        // Game Management Lambda
        this.gameLambda = new lambda.Function(this, 'GameFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/games'),
            environment: this.lambdaEnv,
            environmentEncryption: envVarKey,
            role: this.gameLambdaRole,
            vpc: vpc,
            tracing: lambda.Tracing.ACTIVE,
            logRetention: logs.RetentionDays.ONE_WEEK,
            timeout: cdk.Duration.seconds(10),
        });

        // Event Tracking Lambda
        this.eventLambda = new lambda.Function(this, 'EventFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/events'),
            environment: this.lambdaEnv,
            environmentEncryption: envVarKey,
            role: this.eventLambdaRole,
            vpc: vpc,
            tracing: lambda.Tracing.ACTIVE,
            logRetention: logs.RetentionDays.ONE_WEEK,
            timeout: cdk.Duration.seconds(10),
        });

        this.templatesLambda = new lambda.Function(this, 'TemplatesFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/templates'),
            environment: this.lambdaEnv,
            environmentEncryption: envVarKey,
            role: this.templatesLambdaRole,
            vpc: vpc,
            tracing: lambda.Tracing.ACTIVE,
            logRetention: logs.RetentionDays.ONE_WEEK,
            timeout: cdk.Duration.seconds(10),
        });

        // Status Lambda function
        this.statusLambda = new lambda.Function(this, 'StatusFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('lambda/status'),
            environment: this.lambdaEnv,
            environmentEncryption: envVarKey,
            role: this.statusLambdaRole,
            vpc: vpc,
            tracing: lambda.Tracing.ACTIVE,
            logRetention: logs.RetentionDays.ONE_WEEK,
            timeout: cdk.Duration.seconds(10),
        });
    }
}
