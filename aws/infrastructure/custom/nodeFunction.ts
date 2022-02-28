import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';


type OmitFunctionProps = 'code' | 'runtime' | 'handler';

export interface NodeFunctionProps extends Omit<lambda.FunctionProps, OmitFunctionProps> {
  code: string;
  handler?: string;
  runtime?: lambda.Runtime;
}


export default class NodeFunction extends lambda.Function {
  constructor(scope: cdk.Construct, id: string, props: NodeFunctionProps) {
    super(scope, id, {
      ...props,
      code   : new lambda.AssetCode(props.code),
      handler: props.handler ?? 'index.handler',
      runtime: props.runtime ?? lambda.Runtime.NODEJS_14_X,
    });
  }
}
