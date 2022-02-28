import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2';

import * as crypto from 'crypto';


export interface ApiProps {
  domain?: apigatewayv2.DomainName;
  mappingKey?: string;
  auth?: ApiAuth;
  routes: ApiRoute[];
  cors?: apigatewayv2.CorsPreflightOptions;
  env: AwsEnv;
}

export interface AwsEnv {
  partition: string;
  account: string;
  region: string;
}

export interface ApiAuth {
  audience: string | string[];
  issuer: string;
}

export interface ApiRoute {
  method: string;
  path: string;
  lambda: lambda.IFunction;
  authorization?: ApiRouteAuth;
}

export interface ApiRouteAuth {
  scopes?: string[];
}


const hashRoute = (route: string) => {
  const md5Hasher = crypto.createHash('md5');

  md5Hasher.update(route);

  return md5Hasher.digest('hex').substr(0, 6);
};


export class Api extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ApiProps) {
    super(scope, id);

    const corsAllowedMethods = new Set([apigatewayv2.CorsHttpMethod.OPTIONS]);

    if (props.cors) {
      props.routes.forEach(
        route => corsAllowedMethods.add(route.method as apigatewayv2.CorsHttpMethod));

      if (corsAllowedMethods.has(apigatewayv2.CorsHttpMethod.GET))
        corsAllowedMethods.add(apigatewayv2.CorsHttpMethod.HEAD);
    }

    const api = new apigatewayv2.HttpApi(this, 'Api', {
      corsPreflight: props.cors && {
        ...props.cors,
        allowMethods: Array.from(corsAllowedMethods),
      },
    });

    if (props.domain) {
      new apigatewayv2.ApiMapping(this, 'ApiMapping', {
        api          : api,
        domainName   : props.domain,
        apiMappingKey: props.mappingKey,
      });
    }

    let authorizer: apigatewayv2.CfnAuthorizer | undefined;

    if (props.auth) {
      authorizer = new apigatewayv2.CfnAuthorizer(this, 'Authorizer', {
        apiId           : api.httpApiId,
        authorizerType  : 'JWT',
        identitySource  : ['$request.header.Authorization'],
        jwtConfiguration: {
          audience     : [props.auth.audience].flat(),
          issuer       : props.auth.issuer,
          creationStack: [''],
        },
        name: 'OAuth2',
      });
    }

    const integrations = new Map<string, apigatewayv2.CfnIntegration>();

    // Create routes

    for (const route of props.routes) {
      let integration: apigatewayv2.CfnIntegration;

      // Create/reuse an integration

      if (integrations.has(route.lambda.functionArn)) {
        integration = integrations.get(route.lambda.functionArn)!;
      }
      else {
        integration = new apigatewayv2.CfnIntegration(this,
          `${route.lambda.node.id}Integration`,
          {
            apiId               : api.httpApiId,
            integrationType     : 'AWS_PROXY',
            payloadFormatVersion: '2.0',
            integrationUri      : `arn:${props.env.partition}:apigateway:${props.env.region}:lambda:path/2015-03-31/functions/${route.lambda.functionArn}/invocations`,
          });

        integrations.set(route.lambda.functionArn, integration);
      }

      // Create a route

      const routeKey = `${route.method} ${route.path}`;
      const routeId = `${(route.method + route.path).split('/').join('')}${hashRoute(routeKey)}`;

      if (route.authorization) {
        if (authorizer) {
          new apigatewayv2.CfnRoute(this, `${routeId}Route`, {
            apiId              : api.httpApiId,
            routeKey,
            authorizationType  : 'JWT',
            authorizerId       : authorizer.ref,
            authorizationScopes: route.authorization.scopes,
            target             : `integrations/${integration.ref}`,
          });
        }
        else {
          console.error(`Authorization requested on route '${routeKey}', although authorizer is unspecified`);
        }
      }
      else {
        new apigatewayv2.CfnRoute(this, `${routeId}Route`, {
          apiId : api.httpApiId,
          routeKey,
          target: `integrations/${integration.ref}`,
        });
      }

      // Allow api to execute the lambda

      new lambda.CfnPermission(this, `${routeId}Perm`, {
        action      : 'lambda:InvokeFunction',
        functionName: route.lambda.functionArn,
        principal   : 'apigateway.amazonaws.com',
        sourceArn   : `arn:${props.env.partition}:execute-api:${props.env.region}:${props.env.account}:${api.httpApiId}/*/${route.method}${route.path}`,
      });
    }
  }
}
