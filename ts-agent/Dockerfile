# ============================================
# ビルドステージ
# ============================================
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-slim AS builder

WORKDIR /app

# 依存関係ファイルを先にコピー（レイヤーキャッシュ効率化）
# コード変更時も依存関係が変わらなければキャッシュが効く
COPY package*.json ./

# npm ci: package-lock.json通りに厳密インストール（npm installより高速・確実）
RUN npm ci

# ソースコードをコピー
COPY . ./

# TypeScriptビルド → dist/ に出力される
RUN npm run build

# ============================================
# 本番ステージ（軽量イメージ）
# ============================================
FROM --platform=linux/arm64 public.ecr.aws/docker/library/node:22-slim

WORKDIR /app

# 本番用依存関係のみインストール（devDependencies除外）
COPY package*.json ./
RUN npm ci --omit=dev

# ビルド成果物のみコピー（TypeScript等のソースは含まない）
COPY --from=builder /app/dist ./dist

# セキュリティ: 非rootユーザーで実行
USER node

# AgentCore Runtimeが使用するポート
EXPOSE 8080

# npm経由せず直接実行（起動が速い）
CMD ["node", "dist/index.js"]