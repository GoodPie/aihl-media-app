import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import {AccessLevel} from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import {Construct} from 'constructs';

export interface DistributionProps {
  websiteBucket: s3.Bucket;
  assetsBucket: s3.Bucket;
  api: apigateway.RestApi;
}

export class Distribution extends Construct {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: DistributionProps) {
    super(scope, id);

    // Create CloudFront Distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3StaticWebsiteOrigin(props.websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS
      },
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      additionalBehaviors: {
        '/assets/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(props.assetsBucket, {
            originAccessLevels: [AccessLevel.WRITE, AccessLevel.LIST, AccessLevel.READ]
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
        },
        '/api/*': {
          origin: new origins.RestApiOrigin(props.api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS
        }
      },
      errorResponses: [
        {
          httpStatus: 404,
          responsePagePath: '/index.html',
          responseHttpStatus: 200
        }
      ]
    });

    // Add output
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'The CloudFront Distribution URL'
    });
  }
}
