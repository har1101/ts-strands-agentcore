# Strands Agents SDK (TypeScript) で Hono を使う

## はじめに

Strands Agents SDK の TypeScript 版を使って AI エージェントを構築する際、Web フレームワークとして **Hono** を採用しました。この記事では、Hono の良さと、Docker でデプロイする際の注意点について解説します。

---

## Hono とは？

**Hono（炎）** は、日本発の超軽量・超高速な Web フレームワークです。Express.js の代替として注目されています。

### Express と Hono の比較

| 項目 | Express | Hono |
|------|---------|------|
| パッケージサイズ | 約 200KB + 依存関係 | 約 14KB |
| 速度 | 普通 | Express の約 10 倍速い |
| TypeScript 対応 | 後付け（型定義が別途必要） | ネイティブ対応 |
| 対応ランタイム | Node.js のみ | Node.js, Bun, Deno, Cloudflare Workers |

---

## なぜ Hono を選んだのか？

### 1. 超軽量で高速

Hono はわずか 14KB という驚異的な軽さです。ルーティングには Trie 木というデータ構造を使っており、ルート数が増えても高速に動作します。

AI エージェントの処理は重いため、フレームワーク部分は軽い方が嬉しいですよね。

### 2. TypeScript ファースト

Hono は最初から TypeScript で書かれています。そのため、型推論がとても強力です。

```typescript
// Express の場合 - req, res の型を明示的に指定
app.get('/ping', (req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// Hono の場合 - c (Context) の型は自動推論される
app.get('/ping', (c) => c.json({ status: 'ok' }))
```

### 3. Web 標準 API 準拠

Hono は `Request` / `Response` といった Web 標準 API を使用しています。これにより、Node.js だけでなく、Bun や Cloudflare Workers など、様々なランタイムで同じコードが動きます。

将来的に別の環境へ移行したくなっても、コードの書き換えがほぼ不要です。

### 4. ミドルウェアが不要な場面が多い

Express では、バイナリデータを受け取るために `express.raw()` ミドルウェアが必要でした。

```typescript
// Express - ミドルウェアが必要
app.post('/invocations', express.raw({ type: '*/*' }), async (req, res) => {
  const prompt = new TextDecoder().decode(req.body)
  // ...
})

// Hono - ミドルウェア不要！Web 標準 API をそのまま使える
app.post('/invocations', async (c) => {
  const body = await c.req.arrayBuffer()
  const prompt = new TextDecoder().decode(body)
  // ...
})
```

---

## Hono 特有の書き方

### Context オブジェクト `c`

Express では `req`（リクエスト）と `res`（レスポンス）の 2 つを使いましたが、Hono では **`c` (Context)** に統合されています。

```typescript
app.get('/example', (c) => {
  // リクエスト情報の取得
  const query = c.req.query('name')     // クエリパラメータ
  const param = c.req.param('id')       // パスパラメータ
  const body = await c.req.json()       // JSON ボディ

  // レスポンスの返却
  return c.json({ message: 'Hello' })           // 200 OK
  return c.json({ error: 'Not found' }, 404)    // 404 エラー
})
```

### return が必須

Express では `res.json()` を呼ぶだけで良かったですが、Hono では **`return` が必須** です。

```typescript
// Express - return 不要
app.get('/ping', (req, res) => {
  res.json({ status: 'ok' })
})

// Hono - return 必須！
app.get('/ping', (c) => {
  return c.json({ status: 'ok' })
})
```

### Node.js で動かすにはアダプターが必要

Hono 本体はランタイム非依存のため、Node.js で動かすには `@hono/node-server` というアダプターが必要です。

```typescript
import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

// ルート定義...

// Node.js 用のサーバー起動
serve({ fetch: app.fetch, port: 8080 })
```

ちなみに Bun なら、アダプター不要で動きます。

```typescript
// Bun の場合 - これだけでOK！
export default app
```

---

## ローカルでの起動方法

開発中はローカルで Hono サーバーを起動して動作確認ができます。

### 前提条件

- Node.js がインストールされていること
- AWS 認証情報が設定されていること（Bedrock を使用するため）

### 起動手順

```bash
# ts-agent ディレクトリに移動
cd ts-agent

# 依存関係をインストール
npm install

# TypeScript をビルドして起動（開発用）
npm run dev

# または、ビルドと起動を分けて実行
npm run build   # TypeScript → JavaScript にコンパイル
npm start       # サーバー起動
```

### 起動確認

サーバーが起動すると、以下のようなログが表示されます：

```
🚀 AgentCore Runtime server listening on port 8080
```

### 動作テスト

別のターミナルから curl でリクエストを送信します。

```bash
# ヘルスチェック
curl http://localhost:8080/ping

# エージェント呼び出し
curl -X POST http://localhost:8080/invocations \
  -H "Content-Type: text/plain" \
  -d "今日の天気を教えて"
```

### 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `PORT` | サーバーのポート番号 | `8080` |
| `MODEL_ID` | Bedrock のモデル ID | `jp.anthropic.claude-haiku-4-5-20251001-v1:0` |

```bash
# 環境変数を指定して起動
PORT=3000 MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0 npm run dev
```

---

## Dockerfile の注意点

AI エージェントを Docker でデプロイする際、Dockerfile の書き方でイメージサイズや起動速度が大きく変わります。

### よくある問題点

初心者がやりがちな Dockerfile：

```dockerfile
FROM node:latest

WORKDIR /app
COPY . ./
RUN npm install
RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
```

この書き方には以下の問題があります：

| 問題 | 影響 |
|------|------|
| `node:latest` を使用 | イメージサイズが約 1GB になる |
| `COPY . ./` の後に `npm install` | コード変更のたびに依存関係も再インストールされる |
| devDependencies も含まれる | TypeScript など本番不要なパッケージが含まれる |
| root ユーザーで実行 | セキュリティリスクがある |

### 改善版 Dockerfile

```dockerfile
# ============================================
# ビルドステージ
# ============================================
FROM --platform=linux/arm64 node:22-slim AS builder

WORKDIR /app

# 依存関係ファイルを先にコピー（レイヤーキャッシュ効率化）
COPY package*.json ./

# npm ci: package-lock.json 通りに厳密インストール
RUN npm ci

# ソースコードをコピー
COPY . ./

# TypeScript ビルド
RUN npm run build

# ============================================
# 本番ステージ（軽量イメージ）
# ============================================
FROM --platform=linux/arm64 node:22-slim

WORKDIR /app

# 本番用依存関係のみインストール
COPY package*.json ./
RUN npm ci --omit=dev

# ビルド成果物のみコピー
COPY --from=builder /app/dist ./dist

# セキュリティ: 非 root ユーザーで実行
USER node

EXPOSE 8080

# npm 経由せず直接実行（起動が速い）
CMD ["node", "dist/index.js"]
```

### 改善ポイントの解説

#### 1. マルチステージビルド

`AS builder` で名前をつけたビルド用ステージと、本番用ステージを分けています。

```dockerfile
FROM node:22-slim AS builder   # ビルド用（TypeScript 等をインストール）
# ...ビルド処理...

FROM node:22-slim              # 本番用（ビルド成果物だけコピー）
COPY --from=builder /app/dist ./dist
```

これにより、最終イメージには TypeScript やソースコード（`.ts`）は含まれません。

#### 2. `node:22-slim` を使用

`node:latest` は約 1GB ですが、`node:22-slim` は約 200MB です。5 分の 1 のサイズになります。

#### 3. `package*.json` を先にコピー

```dockerfile
COPY package*.json ./
RUN npm ci
COPY . ./
```

この順番にすることで、ソースコードを変更しても、依存関係が変わっていなければキャッシュが効きます。ビルド時間が大幅に短縮されます。

#### 4. `npm ci` を使用

`npm install` ではなく `npm ci` を使います。

| コマンド | 動作 |
|----------|------|
| `npm install` | package.json を見て、柔軟にインストール |
| `npm ci` | package-lock.json 通りに厳密にインストール |

`npm ci` の方が高速で、再現性も高いです。

#### 5. `--omit=dev` で本番依存のみ

```dockerfile
RUN npm ci --omit=dev
```

これにより、TypeScript などの devDependencies は本番イメージに含まれません。

#### 6. `USER node` で非 root 実行

```dockerfile
USER node
```

Docker はデフォルトで root ユーザーとして実行されます。セキュリティ上、アプリケーションは非 root ユーザーで実行すべきです。`node` ユーザーは Node.js 公式イメージに最初から用意されています。

#### 7. `node` で直接実行

```dockerfile
CMD ["node", "dist/index.js"]
```

`npm start` 経由ではなく、`node` で直接実行することで、起動が少し速くなります。

### 改善結果

| 項目 | 改善前 | 改善後 |
|------|--------|--------|
| イメージサイズ | 約 1GB | 約 200MB |
| ビルドキャッシュ | 効きにくい | 効きやすい |
| devDependencies | 含まれる | 含まれない |
| 実行ユーザー | root | node（非 root） |

---

## CDK + CodeBuild でハマったポイント

AWS CDK と `deploy-time-build` を使って Docker イメージをビルドする際、いくつかのハマりポイントがありました。同じ構成を使う方の参考になれば幸いです。

### 1. `.dockerignore` がないと node_modules が上書きされる

**症状**:
```
Error: Cannot find module '../lib/tsc.js'
Require stack:
- /app/node_modules/.bin/tsc
```

**原因**:

`deploy-time-build` の `ContainerImageBuild` は、ディレクトリを S3 にアップロードして CodeBuild に渡します。このとき、`.dockerignore` がないと **ローカルの `node_modules` がそのままアップロード**されます。

Dockerfile で `npm ci` を実行しても、その後の `COPY . ./` で**ローカルの古い `node_modules` が上書き**されてしまいます。ローカルと Docker 内の npm バージョンが異なると、symlink の構造が壊れて上記のエラーになります。

**解決策**:

プロジェクトに `.dockerignore` を作成して、`node_modules` と `dist` を除外します。

```
node_modules
dist
```

### 2. `package-lock.json` が古いままだと npm ci が壊れる

**症状**:
```
Error: Cannot find module '../lib/tsc.js'
```

**原因**:

`npm ci` は `package-lock.json` を厳密に使用します。`package.json` を変更した後に `npm install` を実行し忘れると、`package-lock.json` との不整合が発生し、パッケージが正しくインストールされません。

例えば、Express から Hono に移行した際、`package-lock.json` を更新し忘れると、古い依存関係がインストールされてしまいます。

**解決策**:

`package.json` を変更したら、必ず `npm install` を実行して `package-lock.json` を更新しましょう。

```bash
cd ts-agent
npm install
```

### 3. `@types/node` がないと process が見つからない

**症状**:
```
error TS2580: Cannot find name 'process'.
Do you need to install type definitions for node?
Try `npm i --save-dev @types/node`.
```

**原因**:

TypeScript で `process.env` を使用するには、Node.js の型定義が必要です。Hono 自体は TypeScript ネイティブですが、Node.js のグローバル変数（`process` など）の型定義は別途インストールが必要です。

**解決策**:

`@types/node` を devDependencies に追加します。

```bash
npm install --save-dev @types/node
```

または `package.json` に直接追加：

```json
{
  "devDependencies": {
    "@types/node": "^22",
    "typescript": "^5.3.3"
  }
}
```

### ハマりポイントまとめ

| エラー | 原因 | 解決策 |
|--------|------|--------|
| `Cannot find module '../lib/tsc.js'` | ローカルの node_modules が上書き | `.dockerignore` を作成 |
| `Cannot find module '../lib/tsc.js'` | package-lock.json が古い | `npm install` で更新 |
| `Cannot find name 'process'` | @types/node がない | `npm i -D @types/node` |

---

## まとめ

- **Hono** は軽量・高速・TypeScript ネイティブな Web フレームワーク
- Express からの移行は簡単（Context オブジェクトと return に注意）
- **Dockerfile** はマルチステージビルドで最適化しよう
- `node:slim` + `npm ci --omit=dev` + `USER node` でセキュアかつ軽量に
