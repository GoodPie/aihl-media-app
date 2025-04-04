import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
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

  constructor(scope: Construct, id: string, props?: DatabaseProps) {
    super(scope, id);

    // Create encryption key for tables
    const encryptionKey = new kms.Key(this, 'TableEncryptionKey', {
      enableKeyRotation: true
    });

    // Teams Table
    this.teamsTable = new dynamodb.Table(this, 'TeamsTable', {
      partitionKey: { name: 'teamId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,
      pointInTimeRecovery: true,
      deletionProtection: true
    });

    // Players Table
    this.playersTable = new dynamodb.Table(this, 'PlayersTable', {
      partitionKey: { name: 'playerId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,
      pointInTimeRecovery: true,
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
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,
      pointInTimeRecovery: true,
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
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,
      pointInTimeRecovery: true,
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
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: encryptionKey,
      pointInTimeRecovery: true,
      deletionProtection: true
    });

    this.templatesTable.addGlobalSecondaryIndex({
      indexName: 'EventTypeIndex',
      partitionKey: { name: 'eventType', type: dynamodb.AttributeType.STRING }
    });
  }

  // Method to grant permissions to a role
  public grantTablePermissions(role: iam.IRole): void {
    // Instead of full read/write access, grant specific permissions
    this.teamsTable.grantReadData(role);
    this.teamsTable.grant(role, 'dynamodb:PutItem', 'dynamodb:UpdateItem');

    this.playersTable.grantReadData(role);
    this.playersTable.grant(role, 'dynamodb:PutItem', 'dynamodb:UpdateItem');

    this.gamesTable.grantReadData(role);
    this.gamesTable.grant(role, 'dynamodb:PutItem', 'dynamodb:UpdateItem');

    this.eventsTable.grantReadData(role);
    this.eventsTable.grant(role, 'dynamodb:PutItem', 'dynamodb:UpdateItem');

    this.templatesTable.grantReadData(role);
    this.templatesTable.grant(role, 'dynamodb:PutItem', 'dynamodb:UpdateItem');
  }
}
