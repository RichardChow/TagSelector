#!/bin/bash

# 测试标签选择器 - Jenkins部署脚本
# 作者: AI Assistant
# 用途: 将测试标签选择器部署到Jenkins的userContent目录

set -e  # 出错时退出

echo "============================================"
echo "测试标签选择器 - Jenkins部署脚本"
echo "============================================"

# 配置变量
JENKINS_HOME=${JENKINS_HOME:-"/var/lib/jenkins"}
DEPLOY_DIR="$JENKINS_HOME/userContent/test-selector"
CURRENT_DIR=$(pwd)

echo "当前目录: $CURRENT_DIR"
echo "Jenkins主目录: $JENKINS_HOME"
echo "部署目录: $DEPLOY_DIR"

# 检查是否有足够的权限
if [ ! -w "$JENKINS_HOME" ]; then
    echo "错误: 没有写入Jenkins主目录的权限，请以正确的用户身份运行此脚本"
    echo "提示: 通常需要以jenkins用户身份运行，或使用sudo"
    exit 1
fi

# 检查必要文件是否存在
echo "检查必要文件..."
required_files=("index.html" "styles.css" "script.js" "data.js")

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "错误: 找不到文件 $file"
        echo "请确保在包含所有文件的目录中运行此脚本"
        exit 1
    fi
    echo "✓ 找到文件: $file"
done

# 创建部署目录
echo "创建部署目录..."
mkdir -p "$DEPLOY_DIR"
echo "✓ 部署目录创建完成: $DEPLOY_DIR"

# 复制文件
echo "复制文件到部署目录..."
cp index.html "$DEPLOY_DIR/"
cp styles.css "$DEPLOY_DIR/"
cp script.js "$DEPLOY_DIR/"
cp data.js "$DEPLOY_DIR/"
echo "✓ 文件复制完成"

# 设置权限
echo "设置文件权限..."
chmod 644 "$DEPLOY_DIR"/*.html
chmod 644 "$DEPLOY_DIR"/*.css
chmod 644 "$DEPLOY_DIR"/*.js
chmod 755 "$DEPLOY_DIR"
echo "✓ 权限设置完成"

# 创建简单的清单文件
echo "创建部署清单..."
cat > "$DEPLOY_DIR/deploy-info.txt" << EOF
测试标签选择器部署信息
========================

部署时间: $(date)
部署者: $(whoami)
部署目录: $DEPLOY_DIR
源目录: $CURRENT_DIR

文件列表:
- index.html (主页面)
- styles.css (样式文件)
- script.js (主要逻辑)
- data.js (数据配置)

访问地址:
- http://10.91.90.109:8080/jenkins/userContent/test-selector/
- 或 http://YOUR_JENKINS_URL/userContent/test-selector/

功能特性:
✓ 功能组折叠/展开
✓ 测试标签选择
✓ 时间自动计算
✓ RobotFramework命令生成
✓ 工具提示和帮助信息
✓ 设置面板和数据同步
✓ 响应式设计
✓ 键盘快捷键支持
EOF

echo "✓ 部署清单创建完成"

# 验证部署
echo "验证部署..."
if [ -f "$DEPLOY_DIR/index.html" ]; then
    echo "✓ 部署验证成功"
else
    echo "✗ 部署验证失败"
    exit 1
fi

echo "============================================"
echo "部署完成！"
echo "============================================"
echo ""
echo "访问地址:"
echo "  http://10.91.90.109:8080/jenkins/userContent/test-selector/"
echo ""
echo "或者使用您的Jenkins URL:"
echo "  http://YOUR_JENKINS_URL/userContent/test-selector/"
echo ""
echo "如果页面无法访问，请检查:"
echo "1. Jenkins是否启用了UserContent服务"
echo "2. 文件权限是否正确"
echo "3. 防火墙设置是否允许访问"
echo ""
echo "详细信息请查看: $DEPLOY_DIR/deploy-info.txt"
echo "============================================" 