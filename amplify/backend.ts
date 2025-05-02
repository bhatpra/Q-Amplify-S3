import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { storage } from './storage/resource';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as q from 'aws-cdk-lib/aws-qbusiness';
import { Duration } from 'aws-cdk-lib';
import { Amplify } from 'aws-amplify';

import outputs from '../amplify_outputs.json';
Amplify.configure(outputs);

const backend = defineBackend({
  auth,
  storage,
});

export const customResource = backend.createStack("CustomResourceStack");

/* DEFINE AMAZON Q BUSINESS APP */

export const qapp = new q.CfnApplication(customResource, "Qapp", {
  displayName: "Qapp",
  description: "CDK instantiated Amazon Q Business App",
  autoSubscriptionConfiguration: {
    autoSubscribe: "ENABLED",
    defaultSubscriptionType: "Q_LITE"
  },
  identityType: "AWS_IAM_IDC",
  roleArn: `arn:aws:iam::${customResource.account}:role/aws-service-role/qbusiness.amazonaws.com/AWSServiceRoleForQBusiness`,
  /* REPLACE WITH YOUR IAM IDENTITY CENTER ARN */
  identityCenterInstanceArn: "arn:aws:sso:::instance/ssoins-<YOUR-IAM-IDC-ARN>",
});


/* Q Business Service Access Role */
const qApplicationServiceAccessRole = new iam.Role(customResource, 'QApplicationServiceAccessRole', {
  roleName: 'QApplicationServiceAccessRole',
  assumedBy: new iam.ServicePrincipal('qbusiness.amazonaws.com'),
  maxSessionDuration: Duration.hours(1),
  inlinePolicies: {
    ApplicationServiceAccessPolicy: new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          sid: 'AmazonQApplicationPutMetricDataPermission',
          effect: iam.Effect.ALLOW,
          actions: ['cloudwatch:PutMetricData'],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'cloudwatch:namespace': 'AWS/QBusiness'
            }
          }
        }),
        new iam.PolicyStatement({
          sid: 'AmazonQApplicationDescribeLogGroupsPermission',
          effect: iam.Effect.ALLOW,
          actions: ['logs:DescribeLogGroups'],
          resources: ['*']
        }),
        new iam.PolicyStatement({
          sid: 'AmazonQApplicationCreateLogGroupPermission',
          effect: iam.Effect.ALLOW,
          actions: ['logs:CreateLogGroup'],
          resources: [
            `arn:aws:logs:us-east-1:${customResource.account}:log-group:/aws/qbusiness/*`
          ]
        }),
        new iam.PolicyStatement({
          sid: 'AmazonQApplicationLogStreamPermission',
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:DescribeLogStreams',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: [
            `arn:aws:logs:us-east-1:${customResource.account}:log-group:/aws/qbusiness/*:log-stream:*`
          ]
        })
      ]
    })
  }
});

qApplicationServiceAccessRole.assumeRolePolicy?.addStatements(
  new iam.PolicyStatement({
    sid: 'AmazonQApplicationPermission',
    effect: iam.Effect.ALLOW,
    actions: ['sts:AssumeRole'],
    principals: [new iam.ServicePrincipal('qbusiness.amazonaws.com')],
    conditions: {
      StringEquals: {
        'aws:SourceAccount': customResource.account
      },
      ArnLike: {
        'aws:SourceArn': `arn:aws:qbusiness:us-east-1:${customResource.account}:application/*`
      }
    }
  })
);

/* DEFINE AMAZON Q BUSINESS INDEX */

export const qIndex = new q.CfnIndex(customResource, "QIndex", {
  displayName: "QIndex",
  description: "CDK instantiated Amazon Q Business App index",
  applicationId: qapp.attrApplicationId,
  capacityConfiguration: {
    units: 1,
  },
  type: "STARTER",
});

/* DEFINE AMAZON Q BUSINESS RETRIEVER */

export const qRetriever = new q.CfnRetriever(customResource, "QRetriever", {
  displayName: "QRetriever",
  applicationId: qapp.attrApplicationId,
  type: "NATIVE_INDEX",
  configuration: {
    nativeIndexConfiguration: {
      indexId: qIndex.attrIndexId,
    },
  }
});

/* S3 Access Role and Trust to Amazon Q Business */
const qBusinessS3Role = new iam.Role(customResource, 'QBusinessS3Role', {
  roleName: 'QBusinessS3Role',
  assumedBy: new iam.ServicePrincipal('qbusiness.amazonaws.com'),
  description: 'IAM role for Amazon Q Business S3 Access',
});

qBusinessS3Role.assumeRolePolicy?.addStatements(new iam.PolicyStatement({
  sid: 'AllowsAmazonQToAssumeRoleForServicePrincipal',
  effect: iam.Effect.ALLOW,
  actions: ['sts:AssumeRole'],
  principals: [new iam.ServicePrincipal('qbusiness.amazonaws.com')],
  conditions: {
    "StringEquals": {
      "aws:SourceAccount": customResource.account
    },
    "ArnLike": {
      "aws:SourceArn": `arn:aws:qbusiness:us-east-1:${customResource.account}:application/${qapp.attrApplicationId}`
    }
  }
}));

qBusinessS3Role.addToPolicy(new iam.PolicyStatement({
  sid: 'AllowsAmazonQToGetObjectfromS3',
  effect: iam.Effect.ALLOW,
  actions: ["s3:GetObject"],
  resources: [`${backend.storage.resources.bucket.bucketArn}/*`],
  conditions: {
    "StringEquals": {
      "aws:ResourceAccount": customResource.account
    }
  }
}));

qBusinessS3Role.addToPolicy(new iam.PolicyStatement({
  sid: 'AllowsAmazonQToListS3Buckets',
  effect: iam.Effect.ALLOW,
  actions: ["s3:ListBucket"],
  resources: [backend.storage.resources.bucket.bucketArn],
  conditions: {
    "StringEquals": {
      "aws:ResourceAccount": customResource.account
    }
  }
}));

qBusinessS3Role.addToPolicy(new iam.PolicyStatement({
  sid: 'AllowsAmazonQToIngestDocuments',
  effect: iam.Effect.ALLOW,
  actions: ["qbusiness:BatchPutDocument", "qbusiness:BatchDeleteDocument"],
  resources: [
    `arn:aws:qbusiness:us-east-1:${customResource.account}:application/${qapp.attrApplicationId}/index/${qIndex.attrIndexId}`
  ]
}));

qBusinessS3Role.addToPolicy(new iam.PolicyStatement({
  sid: 'AllowsAmazonQToCallPrincipalMappingAPIs',
  effect: iam.Effect.ALLOW,
  actions: [
    "qbusiness:PutGroup",
    "qbusiness:CreateUser",
    "qbusiness:DeleteGroup",
    "qbusiness:UpdateUser",
    "qbusiness:ListGroups"
  ],
  resources: [
    `arn:aws:qbusiness:us-east-1:${customResource.account}:application/${qapp.attrApplicationId}`,
    `arn:aws:qbusiness:us-east-1:${customResource.account}:application/${qapp.attrApplicationId}/index/${qIndex.attrIndexId}`,
    `arn:aws:qbusiness:us-east-1:${customResource.account}:application/${qapp.attrApplicationId}/index/${qIndex.attrIndexId}/data-source/*`
  ]
}));

/* DEFINE AMAZON Q BUSINESS DATA SOURCE */

export const qDataSource = new q.CfnDataSource(customResource, "QDataSource", {
  displayName: `${backend.storage.resources.bucket.bucketName}`,
  applicationId: qapp.attrApplicationId,
  indexId: qIndex.attrIndexId,
  configuration: {
    type: "S3",
    syncMode: "FULL_CRAWL",
    syncschedule: "cron(0/5 * * * ? *)",
    connectionConfiguration: {
      repositoryEndpointMetadata: {
        BucketName: backend.storage.resources.bucket.bucketName
      }
    },
    repositoryConfigurations: {
      document: {
        fieldMappings: [
          {
            indexFieldName: "s3_document_id",
            indexFieldType: "STRING",
            dataSourceFieldName: "s3_document_id"
          }
        ]
      }
    },
  },
  roleArn: qBusinessS3Role.roleArn
});

/* KMS Key and Q Business Web Experience Permissions */
const qBusinessKmsKey = new kms.Key(customResource, 'QBusinessKmsKey', {
  description: 'KMS key for QBusiness WebExperience',
  alias: 'QBusinessKmsKey',
  enableKeyRotation: true,
});

const qWebExperienceRole = new iam.Role(customResource, 'QWebExperienceRole', {
  roleName: 'QWebExperienceRole',
  assumedBy: new iam.ServicePrincipal('application.qbusiness.amazonaws.com'),
  description: 'IAM role for Amazon Q Business WebExperience'
});

qWebExperienceRole.assumeRolePolicy?.addStatements(new iam.PolicyStatement({
  sid: 'QBusinessTrustPolicy',
  effect: iam.Effect.ALLOW,
  actions: ["sts:AssumeRole", "sts:SetContext"],
  principals: [new iam.ServicePrincipal('application.qbusiness.amazonaws.com')],
  conditions: {
    "StringEquals": {
      "aws:SourceAccount": customResource.account,
    },
    "ArnEquals": {
      "aws:SourceArn": `arn:aws:qbusiness:us-east-1:${customResource.account}:application/${qapp.attrApplicationId}`
    }
  }
}));

qWebExperienceRole.addToPolicy(new iam.PolicyStatement({
  sid: 'QBusinessGeneralPermissions',
  effect: iam.Effect.ALLOW,
  actions: [
    "qbusiness:Chat",
    "qbusiness:ChatSync",
    "qbusiness:ListMessages",
    "qbusiness:ListConversations",
    "qbusiness:DeleteConversation",
    "qbusiness:PutFeedback",
    "qbusiness:GetWebExperience",
    "qbusiness:GetApplication",
    "qbusiness:ListPlugins",
    "qbusiness:GetChatControlsConfiguration",
    "qbusiness:ListRetrievers",
    "qbusiness:GetRetriever"
  ],
  resources: [
    `arn:aws:qbusiness:us-east-1:${customResource.account}:application/${qapp.attrApplicationId}`,
    `arn:aws:qbusiness:us-east-1:${customResource.account}:application/${qapp.attrApplicationId}/retriever/*`
  ]
}));

qWebExperienceRole.addToPolicy(new iam.PolicyStatement({
  sid: 'QBusinessKMSDecryptPermissions',
  effect: iam.Effect.ALLOW,
  actions: ["kms:Decrypt"],
  resources: [qBusinessKmsKey.keyArn],
  conditions: {
    "StringLike": {
      "kms:ViaService": "qbusiness.us-east-1.amazonaws.com"
    }
  }
}));

/* DEFINE AMAZON Q BUSINESS WEB EXPERIENCE */

export const qWebExperience = new q.CfnWebExperience(customResource, "QWebExperience", {
  applicationId: qapp.attrApplicationId,
  origins: [
    /* REPLACE WITH YOUR AMPLIFY DOMAIN ENDPOINT */
    "https://main.<APP_URL>.amplifyapp.com",
  ],
  samplePromptsControlMode: "ENABLED",
  subtitle: "AnyCompany Generative AI Assistant",
  title: "AnyCompany Q App",
  welcomeMessage: "Welcome to your Amazon Q Business Application!",
  roleArn: qWebExperienceRole.roleArn
});

backend.addOutput({
  custom: {
    q_business_url: qWebExperience.attrDefaultEndpoint,
  },
});