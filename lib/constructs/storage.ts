import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface StorageProps {
  // Any props needed for customization
}

export class Storage extends Construct {
  public readonly assetsBucket: s3.Bucket;
  public readonly websiteBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: StorageProps) {
    super(scope, id);

    // Assets Bucket
    this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST
          ],
          allowedOrigins: ['http://localhost:3000'],
          allowedHeaders: ['Authorization', 'Content-Type']
        }
      ],
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // Website Bucket
    this.websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // Add outputs
    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: this.websiteBucket.bucketName,
      description: 'The name of the S3 bucket for website hosting'
    });

    new cdk.CfnOutput(this, 'AssetsBucketName', {
      value: this.assetsBucket.bucketName,
      description: 'The name of the S3 bucket for assets'
    });
  }

  // Method to grant permissions to a role
  public grantAssetsBucketAccess(role: iam.IRole): void {
    this.assetsBucket.grantReadWrite(role);
  }
}
