import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';
import { ContainerImageBuild } from 'deploy-time-build';
import * as agentcore from '@aws-cdk/aws-bedrock-agentcore-alpha';

export class TsStrandsAgentcoreStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CloudFormation パラメータ: モデルID
    const modelIdParam = new cdk.CfnParameter(this, 'AgentModelId', {
      type: 'String',
      description: 'Bedrock ModelID',
      default: 'jp.anthropic.claude-haiku-4-5-20251001-v1:0',
    });

    // 「deploy-time-build」というL3 Constructを使ってCodeBuildプロジェクト構築~buildキックまで自動的に実施
		const agentcoreRuntimeImage = new ContainerImageBuild(this, 'TSAgentImage', {
			directory: './ts-agent',
			platform: Platform.LINUX_ARM64,
		});

    // AgentCore Runtime(L2 Construct)
		const runtime = new agentcore.Runtime(this, 'AgentCoreRuntime', {
			runtimeName: 'ts_strands_agent',
			agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromEcrRepository(
				agentcoreRuntimeImage.repository,
				agentcoreRuntimeImage.imageTag
			),
			description: 'TypeScript Strands Agent',
			environmentVariables: {
				MODEL_ID: modelIdParam.valueAsString,
			}
		});

    // Bedrock 基盤モデル・Inference Profile へのアクセス権限
		runtime.role.addToPrincipalPolicy(new iam.PolicyStatement({
			actions: [
				'bedrock:InvokeModel',
				'bedrock:InvokeModelWithResponseStream',
			],
			resources: [
				// 基盤モデル（東京・大阪）
				'arn:aws:bedrock:ap-northeast-1::foundation-model/*',
				'arn:aws:bedrock:ap-northeast-3::foundation-model/*',
				// Inference Profile（東京・大阪）
				`arn:aws:bedrock:ap-northeast-1:${this.account}:inference-profile/*`,
				`arn:aws:bedrock:ap-northeast-3:${this.account}:inference-profile/*`,
			],
		}));

  }
}
