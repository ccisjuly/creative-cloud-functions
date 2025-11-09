#!/bin/bash

# HeyGen API Key 部署脚本

echo "🚀 HeyGen API Key 配置和部署脚本"
echo ""

# 检查是否提供了 API Key
if [ -z "$1" ]; then
    echo "❌ 错误: 请提供 HeyGen API Key"
    echo ""
    echo "使用方法:"
    echo "  ./deploy_heygen.sh YOUR_API_KEY"
    echo ""
    echo "或者设置环境变量:"
    echo "  export HEYGEN_API_KEY=your-api-key"
    echo "  ./deploy_heygen.sh"
    exit 1
fi

API_KEY=${1:-$HEYGEN_API_KEY}

if [ -z "$API_KEY" ]; then
    echo "❌ 错误: 未找到 API Key"
    exit 1
fi

echo "📝 配置 HeyGen API Key..."
firebase functions:config:set heygen.api_key="$API_KEY"

echo ""
echo "✅ 配置完成！"
echo ""
echo "🔄 开始部署 Functions..."
firebase deploy --only functions

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 验证配置:"
firebase functions:config:get
