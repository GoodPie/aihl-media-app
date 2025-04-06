import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import {ResourceServerScope} from "aws-cdk-lib/aws-cognito";

export interface AuthenticationProps {
  // Any props needed for customization
}

export class Authentication extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly appClient: cognito.UserPoolClient;
  public readonly adminGroup: cognito.CfnUserPoolGroup;
  public readonly apiResourceServer: cognito.UserPoolResourceServer;


  constructor(scope: Construct, id: string, props?: AuthenticationProps) {
    super(scope, id);

    // Create Cognito User Pool
    this.userPool = new cognito.UserPool(this, 'AIHLMediaPool', {
      selfSignUpEnabled: false,
      autoVerify: { email: true },
      signInAliases: { email: true },
      standardAttributes: {
        email: { required: true },
        phoneNumber: { required: false }
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // Security enhancements
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true
      },
    });

    // Create Admin Group
    this.adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admin',
      description: 'Administrators for AIHL Media Team App',
    });

    this.apiResourceServer = new cognito.UserPoolResourceServer(this, 'AIHLResourceServer', {
      userPool: this.userPool,
      identifier: 'aihl-api',
      scopes: [
        new cognito.ResourceServerScope({ scopeName: 'read', scopeDescription: 'Read access' }),
        new cognito.ResourceServerScope({ scopeName: 'write', scopeDescription: 'Write access' }),
        new cognito.ResourceServerScope({ scopeName: 'admin', scopeDescription: 'Admin access' }),
      ],
    });

    const readOnlyScope = new cognito.ResourceServerScope({ scopeName: 'read', scopeDescription: 'Read-only access' });
    const writeScope = new cognito.ResourceServerScope({ scopeName: 'write', scopeDescription: 'Write access' });
    const adminScope = new cognito.ResourceServerScope({ scopeName: 'admin', scopeDescription: 'Admin access' });


    // Create App Client
    this.appClient = this.userPool.addClient('app-client', {
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.resourceServer(this.apiResourceServer, readOnlyScope),
          cognito.OAuthScope.resourceServer(this.apiResourceServer, writeScope),
          cognito.OAuthScope.resourceServer(this.apiResourceServer, adminScope),
        ],
        callbackUrls: ['http://localhost:5173'],
        logoutUrls: ['http://localhost:5173/logout'],
      },
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true
    });

    // Add outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'The ID of the Cognito User Pool'
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.appClient.userPoolClientId,
      description: 'The ID of the Cognito User Pool Client'
    });

  }
}
