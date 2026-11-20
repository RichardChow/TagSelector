@echo off
chcp 65001 >nul

echo 🚀 测试标签选择器 API 服务器启动脚本 (Windows)
echo ============================================

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python 未安装，请先安装Python3
    pause
    exit /b 1
)

REM 检查当前目录是否有所需文件
if not exist "api_server.py" (
    echo ❌ 未找到 api_server.py 文件
    pause
    exit /b 1
)

if not exist "requirements.txt" (
    echo ❌ 未找到 requirements.txt 文件
    pause
    exit /b 1
)

REM 创建虚拟环境（如果不存在）
if not exist "venv" (
    echo 📦 创建Python虚拟环境...
    python -m venv venv
)

REM 激活虚拟环境
echo 🔧 激活虚拟环境...
call venv\Scripts\activate.bat

REM 安装依赖
echo 📥 安装依赖包...
pip install -r requirements.txt

REM 设置环境变量（可选）
if not defined HOST set HOST=0.0.0.0
if not defined PORT set PORT=5000
if not defined DEBUG set DEBUG=False

echo 📊 服务器配置:
echo   - 地址: %HOST%
echo   - 端口: %PORT%
echo   - 调试模式: %DEBUG%
echo.

REM 启动服务器
echo 🌐 启动 API 服务器...
python start_server.py

pause 