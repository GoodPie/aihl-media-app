import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthenticationProps {
  // Any props needed for customization
}

export class Authentication extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly appClient: cognito.UserPoolClient;
  public readonly adminGroup: cognito.CfnUserPoolGroup;

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

    // Create App Client
    this.appClient = this.userPool.addClient('app-client', {
      authFlows: {
        userPassword: true,
        userSrp: true
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: ['http://localhost:3000/callback'],
        logoutUrls: ['http://localhost:3000/logout']
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
