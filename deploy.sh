#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="image-merge"

echo "==> 构建项目..."
npm run build

# 首次运行时自动创建 Cloudflare Pages 项目（已存在则忽略）
if ! npx wrangler pages project list 2>/dev/null | grep -q "^${PROJECT_NAME}$"; then
  echo "==> 创建 Cloudflare Pages 项目: ${PROJECT_NAME}"
  npx wrangler pages project create "$PROJECT_NAME" --production-branch=main
fi

echo "==> 部署到 Cloudflare Pages..."
npx wrangler pages deploy dist --project-name="$PROJECT_NAME"

echo "==> 部署完成!"
