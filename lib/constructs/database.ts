import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface DatabaseProps {
  // Any props needed for customization
}

export class Database extends Construct {
  public readonly teamsTable: dynamodb.Table;
  public readonly playersTable: dynamodb.Table;
  public readonly gamesTable: dynamodb.Table;
  public readonly eventsTable: dynamodb.Table;
  public readonly templatesTable: dynamodb.Table;
  public readonly templatesCategoryTable: dynamodb.Table;
  public readonly templateVariablesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: DatabaseProps) {
    super(scope, id);

    // Teams Table
    this.teamsTable = new dynamodb.Table(this, 'TeamsTable', {
      partitionKey: { name: 'teamId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: true
    });

    // Players Table
    this.playersTable = new dynamodb.Table(this, 'PlayersTable', {
      partitionKey: { name: 'playerId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: true
    });

    this.playersTable.addGlobalSecondaryIndex({
      indexName: 'TeamIndex',
      partitionKey: { name: 'teamId', type: dynamodb.AttributeType.STRING }
    });

    // Games Table
    this.gamesTable = new dynamodb.Table(this, 'GamesTable', {
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: true
    });

    this.gamesTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gameDate', type: dynamodb.AttributeType.STRING }
    });

    // Events Table
    this.eventsTable = new dynamodb.Table(this, 'EventsTable', {
      partitionKey: { name: 'eventId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: true
    });

    this.eventsTable.addGlobalSecondaryIndex({
      indexName: 'GameIndex',
      partitionKey: { name: 'gameId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'eventTime', type: dynamodb.AttributeType.STRING }
    });

    // Templates Table
    this.templatesTable = new dynamodb.Table(this, 'TemplatesTable', {
      partitionKey: { name: 'templateId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: true
    });

    this.templatesTable.addGlobalSecondaryIndex({
      indexName: 'EventTypeIndex',
      partitionKey: { name: 'eventType', type: dynamodb.AttributeType.STRING }
    });

    this.templatesTable.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: { name: 'categoryId', type: dynamodb.AttributeType.STRING }
    });

    // Templates Category Table
    this.templatesCategoryTable = new dynamodb.Table(this, 'TemplatesCategoryTable', {
      partitionKey: { name: 'categoryId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: true
    });

    // Template Variables Table
    this.templateVariablesTable = new dynamodb.Table(this, 'TemplateVariablesTable', {
      partitionKey: { name: 'variableName', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: true
    });

    this.templateVariablesTable.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING }
    });

  }

  // Method to grant permissions to a role
  public grantTablePermissions(role: iam.IRole): void {
    this.teamsTable.grantReadData(role);
    this.teamsTable.grant(
        role,
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:GetItem',
        'dynamodb:Scan',
        'dynamodb:Query'
    );

    this.playersTable.grantReadData(role);
    this.playersTable.grant(
        role,
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:GetItem',
        'dynamodb:Scan',
        'dynamodb:Query'
    );

    this.gamesTable.grantReadData(role);
    this.gamesTable.grant(
        role,
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:GetItem',
        'dynamodb:Scan',
        'dynamodb:Query'
    );

    this.eventsTable.grantReadData(role);
    this.eventsTable.grant(
        role,
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:GetItem',
        'dynamodb:Scan',
        'dynamodb:Query'
    );

    this.templatesTable.grantReadData(role);
    this.templatesTable.grant(
        role,
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:GetItem',
        'dynamodb:Scan',
        'dynamodb:Query');

    this.templatesCategoryTable.grantReadData(role);
    this.templatesCategoryTable.grant(
        role,
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:GetItem',
        'dynamodb:Scan',
        'dynamodb:Query');

    this.templateVariablesTable.grantReadData(role);
    this.templateVariablesTable.grant(
        role,
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:GetItem',
        'dynamodb:Scan',
        'dynamodb:Query');
  }

}
