#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生产环境启动脚本
"""

import os
import sys
import logging
from datetime import datetime

# 检查Python版本
if sys.version_info < (3, 6):
    print("❌ 需要Python 3.6或更高版本")
    sys.exit(1)

# 检查依赖
try:
    from flask import Flask
    from flask_cors import CORS
except ImportError as e:
    print(f"❌ 缺少依赖包: {e}")
    print("请运行: pip install -r requirements.txt")
    sys.exit(1)

def setup_production_logging():
    """设置生产环境日志"""
    log_dir = 'logs'
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    log_file = os.path.join(log_dir, f'api_server_{datetime.now().strftime("%Y%m%d")}.log')
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )

def main():
    """主启动函数"""
    print("🚀 启动测试标签选择器 API 服务器...")
    
    # 设置生产环境日志
    setup_production_logging()
    
    # 导入应用
    from api_server import app, ensure_data_directory, logger
    
    # 确保数据目录存在
    ensure_data_directory()
    
    # 获取配置
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"🌐 服务器地址: http://{host}:{port}")
    logger.info(f"🔧 调试模式: {'开启' if debug else '关闭'}")
    logger.info(f"📊 API状态检查: http://{host}:{port}/jenkins/109/api/status")
    
    # 启动服务器
    try:
        app.run(
            host=host,
            port=port,
            debug=debug,
            threaded=True,
            use_reloader=False  # 生产环境关闭重载
        )
    except Exception as e:
        logger.error(f"❌ 服务器启动失败: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main() 