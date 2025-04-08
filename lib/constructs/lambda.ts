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
    templatesCategoryTable: dynamodb.Table;
    templateVariablesTable: dynamodb.Table;
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

    private readonly environmentVariableKey: kms.IKey;
    private readonly vpc: ec2.IVpc;

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

        // Common Lambda environment variables
        this.lambdaEnv = {
            TEAMS_TABLE: props.teamsTable.tableName,
            PLAYERS_TABLE: props.playersTable.tableName,
            GAMES_TABLE: props.gamesTable.tableName,
            EVENTS_TABLE: props.eventsTable.tableName,
            TEMPLATES_TABLE: props.templatesTable.tableName,
            TEMPLATE_CATEGORIES_TABLE: props.templatesCategoryTable.tableName,
            TEMPLATE_VARIABLES_TABLE: props.templateVariablesTable.tableName,
            ASSETS_BUCKET: props.assetsBucket.bucketName,
            USER_POOL_ID: props.userPool.userPoolId,
            CLIENT_ID: props.appClient.userPoolClientId
        };

        // Create VPC for Lambda functions
        this.vpc = this.createVPC();

        // Create encryption key for environment variables
        this.environmentVariableKey = new kms.Key(this, 'EnvVarKey', {
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
        props.teamsTable.grant(this.gameLambdaRole, 'dynamodb:GetItem', 'dynamodb:UpdateItem');

        props.teamsTable.grantReadData(this.playerLambdaRole);
        props.playersTable.grantReadData(this.playerLambdaRole);
        props.playersTable.grant(this.playerLambdaRole, 'dynamodb:PutItem', 'dynamodb:UpdateItem');

        props.gamesTable.grantReadData(this.gameLambdaRole);
        props.gamesTable.grant(this.gameLambdaRole, 'dynamodb:PutItem', 'dynamodb:UpdateItem');
        props.gamesTable.grant(this.teamLambdaRole, 'dynamodb:GetItem', 'dynamodb:UpdateItem');
        props.gamesTable.grantReadWriteData(this.teamLambdaRole);
        props.gamesTable.grantReadWriteData(this.eventLambdaRole);

        props.eventsTable.grantReadData(this.eventLambdaRole);
        props.eventsTable.grant(this.eventLambdaRole, 'dynamodb:PutItem', 'dynamodb:UpdateItem');
        props.eventsTable.grantReadWriteData(this.gameLambdaRole);
        props.templatesTable.grantReadData(this.eventLambdaRole);

        // Grant permissions to templates Lambda role
        props.templatesTable.grantFullAccess(this.templatesLambdaRole);
        props.templatesCategoryTable.grantFullAccess(this.templatesLambdaRole);
        props.templateVariablesTable.grantFullAccess(this.templatesLambdaRole);
        props.templatesTable.grant(this.templatesLambdaRole, "dynamodb:Scan", "dynamodb:Query");
        props.templatesCategoryTable.grantFullAccess(this.templatesLambdaRole);
        props.templateVariablesTable.grant(this.templatesLambdaRole, "dynamodb:Scan", "dynamodb:Query");

        // Grant asset bucket access to all roles
        props.assetsBucket.grantRead(this.teamLambdaRole);
        props.assetsBucket.grantRead(this.playerLambdaRole);
        props.assetsBucket.grantRead(this.gameLambdaRole);
        props.assetsBucket.grantRead(this.eventLambdaRole);
        props.assetsBucket.grantRead(this.templatesLambdaRole);

        // Team Management Lambda
        this.teamLambda = this.createLambdaFunction(
            'TeamFunction',
            this.teamLambdaRole,
            'lambda/teams'
        );

        // Player Management Lambda
        this.playerLambda = this.createLambdaFunction(
            'PlayerFunction',
            this.playerLambdaRole,
            'lambda/players'
        );

        // Game Management Lambda
        this.gameLambda = this.createLambdaFunction(
            'GameFunction',
            this.gameLambdaRole,
            'lambda/games'
        );


        // Event Tracking Lambda
        this.eventLambda = this.createLambdaFunction(
            'EventFunction',
            this.eventLambdaRole,
            'lambda/events'
        );

        this.templatesLambda = this.createLambdaFunction(
            'TemplatesFunction',
            this.templatesLambdaRole,
            'lambda/templates'
        );

        // Status Lambda function
        this.statusLambda = this.createLambdaFunction(
            'StatusFunction',
            this.statusLambdaRole,
            'lambda/status'
        );
    }

    /**
     * Creates a Lambda function with the specified parameters.
     * @param identifier The identifier for the Lambda function.
     * @param role The IAM role to be assumed by the Lambda function.
     * @param assetPath The path to the Lambda function code.
     */
    createLambdaFunction(identifier: string, role: iam.IRole, assetPath: string): lambda.Function {
        return new lambda.Function(this, identifier, {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(assetPath),
            environment: this.lambdaEnv,
            environmentEncryption: this.environmentVariableKey,
            role: role,
            vpc: this.vpc,
            tracing: lambda.Tracing.ACTIVE,
            logRetention: logs.RetentionDays.ONE_WEEK,
            timeout: cdk.Duration.seconds(10),
        });
    }

    createVPC(availabilityZones = 2, natGateways=1): ec2.IVpc {
        return new ec2.Vpc(this, 'LambdaVpc', {
            maxAzs: availabilityZones,
            natGateways: natGateways
        });

    }
}
