import * as cdk from '@aws-cdk/core';
import * as iam from '@aws-cdk/aws-iam';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as route53 from '@aws-cdk/aws-route53';
import * as route53Targets from '@aws-cdk/aws-route53-targets';
import * as s3 from '@aws-cdk/aws-s3';
import * as lambda from '@aws-cdk/aws-lambda';
import * as lambdaEventSources from '@aws-cdk/aws-lambda-event-sources';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2';
import * as sqs from '@aws-cdk/aws-sqs';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as cloudfrontOrigins from '@aws-cdk/aws-cloudfront-origins';

import { Auth } from './custom/auth';
import { Api } from './custom/api';
import NodeFunction from './custom/nodeFunction';

import params from './params';


class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sharpLayer = new lambda.LayerVersion(this, 'SharpLayer', {
      code              : new lambda.AssetCode('dist/aws/layers/sharp/'),
      layerVersionName  : 'sharp',
      description       : 'Sharp nodejs module containing binaries',
      compatibleRuntimes: [
        lambda.Runtime.NODEJS_14_X,
      ],
    });

    const uploadImageLambda = new NodeFunction(this, 'UploadImageLambda', {
      code   : 'dist/aws/lambda/upload_image',
      timeout: cdk.Duration.seconds(1),
    });

    const postImageLambda = new NodeFunction(this, 'PostImageLambda', {
      code      : 'dist/aws/lambda/post_image',
      layers    : [sharpLayer],
      memorySize: 1024,
      timeout   : cdk.Duration.seconds(10),
    });

    const changeImageOrderLambda = new NodeFunction(this, 'ChangeImageOrderLambda', {
      code   : 'dist/aws/lambda/change_image_order',
      timeout: cdk.Duration.seconds(4),
    });

    const deleteImageLambda = new NodeFunction(this, 'DeleteImageLambda', {
      code   : 'dist/aws/lambda/delete_image',
      timeout: cdk.Duration.seconds(6),
    });

    const getImagesLambda = new NodeFunction(this, 'GetImagesLambda', {
      code   : 'dist/aws/lambda/get_images',
      timeout: cdk.Duration.seconds(2),
    });

    const getImageBaseLambda = new NodeFunction(this, 'GetImageBaseLambda', {
      code   : 'dist/aws/lambda/get_image_base',
      timeout: cdk.Duration.seconds(2),
    });

    const getUploadsLambda = new NodeFunction(this, 'GetUploadsLambda', {
      code   : 'dist/aws/lambda/get_uploads',
      timeout: cdk.Duration.seconds(3),
    });

    const getTagsLambda = new NodeFunction(this, 'GetTagsLambda', {
      code   : 'dist/aws/lambda/get_tags',
      timeout: cdk.Duration.seconds(2),
    });

    const ddbQueueLambda = new NodeFunction(this, 'DdbQueueLambda', {
      code   : 'dist/aws/lambda/ddb_queue',
      timeout: cdk.Duration.seconds(2),
    });


    if (params.environment === 'production') {

      // -- Importing acm certificates
      const usEast1Cert = acm.Certificate.fromCertificateArn(
        this, 'esEast1Cert', params.usEast1AcmCertificateArn);
      const regionalCert = acm.Certificate.fromCertificateArn(
        this, 'regionalCert', params.regionalAcmCertificateArn);

      // -- Importing hosted zone
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        zoneName    : params.domain,
        hostedZoneId: params.hostedZoneId,
      });

      // -- Bucket definition

      const bucket = new s3.Bucket(this, 'Bucket');

      bucket.addCorsRule({
        allowedOrigins: params.corsAllowedOrigins,
        allowedMethods: [
          s3.HttpMethods.HEAD,
          s3.HttpMethods.GET,
          s3.HttpMethods.POST,
        ],
      });

      // -- -- Grants

      bucket.grantRead(getUploadsLambda);
      bucket.grantWrite(uploadImageLambda);
      bucket.grantReadWrite(postImageLambda);
      bucket.grantWrite(deleteImageLambda);


      // -- Cloudfront definition

      const oai = new cloudfront.OriginAccessIdentity(this, 'OAI');

      bucket.addToResourcePolicy(new iam.PolicyStatement({
        effect    : iam.Effect.ALLOW,
        actions   : ['s3:GetObject'],
        resources : [`${bucket.bucketArn}/${params.imgStorePrefix}*`],
        principals: [oai.grantPrincipal],
      }));

      const cdn = new cloudfront.Distribution(this, 'Cdn', {
        defaultBehavior: {
          origin: new cloudfrontOrigins.S3Origin(bucket, {
            originAccessIdentity: oai,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods      : cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          compress            : false,
          cachePolicy         :
            cloudfront.CachePolicy.CACHING_OPTIMIZED_FOR_UNCOMPRESSED_OBJECTS,
        },
        domainNames: [`${params.cdnHostname}.${params.domain}`],
        certificate: usEast1Cert,
        priceClass : cloudfront.PriceClass.PRICE_CLASS_100,
      });

      // -- DynamoDB definition

      const ddb = new dynamodb.Table(this, 'Ddb', {
        partitionKey : { name: 'a', type: dynamodb.AttributeType.BINARY },
        sortKey      : { name: 'b', type: dynamodb.AttributeType.STRING },
        readCapacity : 1,
        writeCapacity: Math.ceil(params.wcu / 2),
      });

      // -- -- Global overloaded index

      ddb.addGlobalSecondaryIndex({
        indexName     : 'c-overload',
        partitionKey  : { name: 'b', type: dynamodb.AttributeType.STRING },
        sortKey       : { name: 'c', type: dynamodb.AttributeType.BINARY },
        projectionType: dynamodb.ProjectionType.ALL,
        readCapacity  : params.rcu - 1,
        writeCapacity : Math.floor(params.wcu / 2),
      });

      // -- -- Grants

      ddb.grantReadData(getImagesLambda);
      ddb.grantReadData(getImageBaseLambda);
      ddb.grantReadData(getTagsLambda);
      ddb.grantWriteData(deleteImageLambda);
      ddb.grantReadWriteData(postImageLambda);
      ddb.grantReadWriteData(changeImageOrderLambda);
      ddb.grantReadWriteData(ddbQueueLambda);

      // -- Queues

      const deadLetterQueue = new sqs.Queue(this, 'DLBackoffQueue');

      const backoffQueue = new sqs.Queue(this, 'BackoffQueue', {
        deadLetterQueue: {
          queue          : deadLetterQueue,
          maxReceiveCount: 6,
        },
      });

      // -- -- Grants

      [postImageLambda, changeImageOrderLambda, deleteImageLambda, ddbQueueLambda]
        .forEach((lambda) => {
          backoffQueue.grantSendMessages(lambda);
        });

      backoffQueue.grantConsumeMessages(ddbQueueLambda);

      // -- -- Register as an event source for Lambda

      ddbQueueLambda.addEventSource(new lambdaEventSources.SqsEventSource(backoffQueue));

      // -- Cognito authentication

      const auth = new Auth(this, 'Auth', {
        domain        : params.domain,
        hostname      : params.authHostname,
        certificate   : usEast1Cert,
        callbackURL   : params.oAuth2CallbackURL,
        logoutURL     : params.oAuth2LogoutURL,
        resourceServer: `https://${params.apiHostname}.${params.domain}`,
        scopes        : {
          'read:image' : 'Unrestricted image read access',
          'write:image': 'Image write access',
        },
      });

      // -- API definition

      const apiDomain = new apigatewayv2.DomainName(this, 'ApiDomain', {
        domainName : `${params.apiHostname}.${params.domain}`,
        certificate: regionalCert,
      });

      new Api(this, 'ApiV1', {
        auth: {
          audience: auth.oauth2ClientId,
          issuer  : auth.providerURL,
        },
        routes: [
          {
            lambda       : postImageLambda,
            method       : 'POST',
            path         : '/image',
            authorization: {
              scopes: [auth.scopes['write:image']],
            },
          },
          {
            lambda       : deleteImageLambda,
            method       : 'DELETE',
            path         : '/image',
            authorization: {
              scopes: [auth.scopes['write:image']],
            },
          },
          {
            lambda       : getImageBaseLambda,
            method       : 'GET',
            path         : '/image/base',
            authorization: {
              scopes: [auth.scopes['read:image']],
            },
          },
          {
            lambda       : uploadImageLambda,
            method       : 'POST',
            path         : '/image/upload',
            authorization: {
              scopes: [auth.scopes['write:image']],
            },
          },
          {
            lambda       : changeImageOrderLambda,
            method       : 'PUT',
            path         : '/image/order',
            authorization: {
              scopes: [auth.scopes['write:image']],
            },
          },
          {
            lambda: getImagesLambda,
            method: 'GET',
            path  : '/images',
          },
          {
            lambda       : getUploadsLambda,
            method       : 'GET',
            path         : '/images/uploads',
            authorization: {
              scopes: [auth.scopes['read:image']],
            },
          },
          {
            lambda: getTagsLambda,
            method: 'GET',
            path  : '/tags',
          },
        ],
        cors: {
          allowOrigins    : params.corsAllowedOrigins,
          allowHeaders    : ['Authorization', 'Content-Type'],
          allowCredentials: true,
          maxAge          : cdk.Duration.hours(1),
        },
        domain    : apiDomain,
        mappingKey: 'v1',
        env       : this,
      });

      // -- DNS records

      new route53.ARecord(this, 'ApiDNSRecord', {
        zone      : hostedZone,
        recordName: params.apiHostname,
        target    : route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayv2DomainProperties(
            apiDomain.regionalDomainName,
            apiDomain.regionalHostedZoneId,
          )),
      });

      new route53.ARecord(this, 'AuthDNSRecord', {
        zone      : hostedZone,
        recordName: params.authHostname,
        target    : route53.RecordTarget.fromAlias(
          new route53Targets.UserPoolDomainTarget(auth.domain),
        ),
      });

      new route53.ARecord(this, 'CdnDNSRecord', {
        zone      : hostedZone,
        recordName: params.cdnHostname,
        target    : route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(cdn),
        ),
      });

      // -- Lambda environment variables

      [uploadImageLambda, postImageLambda, changeImageOrderLambda, deleteImageLambda,
        getImagesLambda, getImageBaseLambda, getUploadsLambda, getTagsLambda]
        .forEach((lambda) => {
          const addEnvironment =
            (key: string, value: string) => lambda.addEnvironment(key, value);

          addEnvironment('BUCKET_NAME', bucket.bucketName);
          addEnvironment('TABLE_NAME', ddb.tableName);
          addEnvironment('DDB_QUEUE_URL', backoffQueue.queueUrl);
          addEnvironment('UPLOADS_STORE_PREFIX', params.uploadsStorePrefix);
          addEnvironment('RAW_IMG_STORE_PREFIX', params.rawImgStorePrefix);
          addEnvironment('IMG_STORE_PREFIX', params.imgStorePrefix);
          addEnvironment('POST_IMAGE_MAX_TAGS', String(params.postImageMaxTags));
          addEnvironment('POST_IMAGE_MAX_ASPECTS', String(params.postImageMaxAspects));
          addEnvironment('GET_IMAGES_PAGE_SIZE', String(params.getImagesPageSize));
          addEnvironment('GET_IMAGES_BY_TAG_PAGE_SIZE',
            String(params.getImagesByTagPageSize));
          addEnvironment('GET_UPLOADS_PAGE_SIZE', String(params.getUploadsPageSize));
          addEnvironment('UPLOAD_IMAGE_EXPIRES', String(params.uploadImageExpires));

        });

      ddbQueueLambda.addEnvironment('TABLE_NAME', ddb.tableName);
      ddbQueueLambda.addEnvironment('DDB_QUEUE_URL', backoffQueue.queueUrl);
    }
    else {
      throw new Error(`Development stack is currently unsupported`);
    }
  }
}

const app = new cdk.App();

new Stack(app, 'mwr-api', {
  description: params.environment === 'production' ?
    `${params.domain} backend services` : '',
});

app.synth();
