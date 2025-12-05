/**
 * 実行する際は以下コマンド
 * $ npx ts-node script/invoke.ts "<prompt>"
 */
import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand,
} from '@aws-sdk/client-bedrock-agentcore'

async function main() {
  const input_text = process.argv[2]

  if (!input_text) {
    console.error('Usage: npx ts-node script/invoke.ts "<prompt>"')
    process.exit(1)
  }

  const client = new BedrockAgentCoreClient({
    region: 'ap-northeast-1',
  })

  const input = {
    // Generate unique session ID
    runtimeSessionId: 'test-session-' + Date.now() + '-' + Math.random().toString(36).substring(7),
    // Replace with your actual runtime ARN
    agentRuntimeArn:
      'arn:aws:bedrock-agentcore:ap-northeast-1:975050047634:runtime/ts_strands_agent-if6z5WDfCx',
    qualifier: 'DEFAULT',
    payload: new TextEncoder().encode(input_text),
  }

  const command = new InvokeAgentRuntimeCommand(input)
  const response = await client.send(command)

  if (!response.response) {
    throw new Error('No response received from agent')
  }

  const textResponse = await response.response.transformToString()
  console.log('Response:', textResponse)
}

main()