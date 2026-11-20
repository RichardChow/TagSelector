#!/bin/bash

# 测试标签选择器 API 服务器启动脚本

echo "🚀 测试标签选择器 API 服务器启动脚本"
echo "=================================="

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装Python3"
    exit 1
fi

# 检查当前目录是否有所需文件
if [ ! -f "api_server.py" ]; then
    echo "❌ 未找到 api_server.py 文件"
    exit 1
fi

if [ ! -f "requirements.txt" ]; then
    echo "❌ 未找到 requirements.txt 文件"
    exit 1
fi

# 创建虚拟环境（如果不存在）
if [ ! -d "venv" ]; then
    echo "📦 创建Python虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
echo "🔧 激活虚拟环境..."
source venv/bin/activate

# 安装依赖
echo "📥 安装依赖包..."
pip install -r requirements.txt

# 设置环境变量（可选）
export HOST=${HOST:-"0.0.0.0"}
export PORT=${PORT:-"5000"}
export DEBUG=${DEBUG:-"False"}

echo "📊 服务器配置:"
echo "  - 地址: $HOST"
echo "  - 端口: $PORT"
echo "  - 调试模式: $DEBUG"
echo ""

# 启动服务器
echo "🌐 启动 API 服务器..."
python start_server.py 