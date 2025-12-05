import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import * as strands from '@strands-agents/sdk'
import { httpRequest } from '@strands-agents/sdk/vended_tools/http_request'

const PORT = Number(process.env.PORT) || 8080
const MODEL_ID = process.env.MODEL_ID || 'jp.anthropic.claude-haiku-4-5-20251001-v1:0'

const bedrock = new strands.BedrockModel({ modelId: MODEL_ID })
const agent = new strands.Agent({ model: bedrock, tools: [httpRequest] })

const app = new Hono()

// ヘルスチェック
app.get('/ping', (c) =>
  c.json({
    status: 'Healthy',
    time_of_last_update: Math.floor(Date.now() / 1000),
  })
)

// エージェント呼び出し
app.post('/invocations', async (c) => {
  try {
    const body = await c.req.arrayBuffer()
    const prompt = new TextDecoder().decode(body)
    const response = await agent.invoke(prompt)
    return c.json({ response })
  } catch (err) {
    console.error('Error processing request:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// サーバー起動
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`🚀 AgentCore Runtime server listening on port ${PORT}`)
})