import * as cdk from '@aws-cdk/core';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as cognito from '@aws-cdk/aws-cognito';


export interface AuthProps {
  domain: string;
  hostname: string;
  /**
   * us-east-1 ACM certificate
   */
  certificate?: acm.ICertificate;
  callbackURL: string | string[];
  logoutURL?: string | string[];
  resourceServer: string;
  scopes: ScopesDefinition;
}

export interface ScopesDefinition {
  [scope: string]: string;
}


export class Auth<T extends AuthProps> extends cdk.Construct {
  public scopes: {[P in keyof T['scopes']]: string};
  public domain: cognito.UserPoolDomain;
  public oauth2ClientId: string;
  public providerURL: string;

  constructor(scope: cdk.Construct, id: string, props: T) {
    super(scope, id);

    const userPool = new cognito.UserPool(this, 'UserPool', {
      accountRecovery  : cognito.AccountRecovery.NONE,
      selfSignUpEnabled: false,
      passwordPolicy   : {
        minLength           : 12,
        requireLowercase    : true,
        requireUppercase    : true,
        requireDigits       : true,
        requireSymbols      : true,
        tempPasswordValidity: cdk.Duration.days(1),
      },
      signInCaseSensitive: false,
    });

    this.providerURL = userPool.userPoolProviderUrl;

    const resourceServer = new cognito.UserPoolResourceServer(this, 'ResourceServer', {
      userPool,
      userPoolResourceServerName: `${props.domain} resource server`,
      identifier                : props.resourceServer,
      scopes                    : Object.entries(props.scopes)
        .map(([scopeName, scopeDescription]) => ({ scopeName, scopeDescription })),
    });

    const fullyDefinedCustomScopes: cognito.OAuthScope[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.scopes = {} as any;

    for (const scopeName in props.scopes) {
      const fullScopeName = `${props.resourceServer}/${scopeName}`;

      fullyDefinedCustomScopes.push(cognito.OAuthScope.custom(fullScopeName));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.scopes as any)[scopeName] = fullScopeName;
    }

    const oauth2Client = new cognito.UserPoolClient(this, 'Oauth2Client', {
      userPool,
      oAuth: {
        flows       : { authorizationCodeGrant: true },
        scopes      : fullyDefinedCustomScopes,
        callbackUrls: [props.callbackURL].flat(),
        logoutUrls  : props.logoutURL ? [props.logoutURL].flat() : undefined,
      },
      preventUserExistenceErrors: true,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });

    this.oauth2ClientId = oauth2Client.userPoolClientId;

    oauth2Client.node.addDependency(resourceServer);

    if (props.certificate) {
      this.domain = new cognito.UserPoolDomain(this, 'Domain', {
        userPool,
        customDomain: {
          domainName : `${props.hostname}.${props.domain}`,
          certificate: props.certificate,
        },
      });
    }
    else {
      this.domain = new cognito.UserPoolDomain(this, 'Domain', {
        userPool,
        cognitoDomain: {
          domainPrefix: `${props.domain}-${props.hostname}`,
        },
      });
    }
  }
}
