#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试标签选择器 - Python API服务器
提供数据存储和配置管理服务（共享数据模式）
"""

import json
import os
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import traceback

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('api_server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# 详细的CORS配置
CORS(app, 
     origins=['http://10.91.90.109:8080', 'http://localhost:8080'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'],
     supports_credentials=True)

# 数据目录配置
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
CURRENT_DATA_FILE = os.path.join(DATA_DIR, 'current_data.json')
CONFIGS_FILE = os.path.join(DATA_DIR, 'configs.json')

def ensure_data_directory():
    """确保数据目录存在"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        logger.info(f"📁 创建数据目录: {DATA_DIR}")

def load_json_file(file_path, default_value=None):
    """安全加载JSON文件"""
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                logger.info(f"✅ 成功加载文件: {file_path}")
                return data
        else:
            logger.info(f"📝 文件不存在，返回默认值: {file_path}")
            return default_value
    except Exception as e:
        logger.error(f"❌ 加载文件失败 {file_path}: {str(e)}")
        return default_value

def save_json_file(file_path, data):
    """安全保存JSON文件"""
    try:
        ensure_data_directory()
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"✅ 成功保存文件: {file_path}")
        return True
    except Exception as e:
        logger.error(f"❌ 保存文件失败 {file_path}: {str(e)}")
        return False

@app.route('/jenkins/109/api/saveCurrentData', methods=['POST'])
def save_current_data():
    """保存当前解析的数据"""
    try:
        request_data = request.get_json()
        
        if not request_data or 'data' not in request_data:
            return jsonify({'error': '缺少数据字段'}), 400
        
        data = request_data['data']
        
        # 添加元数据
        save_data = {
            'data': data,
            'savedAt': datetime.now().isoformat(),
            'version': '1.0'
        }
        
        success = save_json_file(CURRENT_DATA_FILE, save_data)
        
        if success:
            logger.info(f"💾 已保存当前数据，功能组数: {len(data.get('featureGroups', []))}")
            return jsonify({
                'success': True,
                'message': '数据保存成功',
                'savedAt': save_data['savedAt']
            })
        else:
            return jsonify({'error': '保存数据失败'}), 500
            
    except Exception as e:
        logger.error(f"❌ 保存当前数据异常: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/jenkins/109/api/loadCurrentData', methods=['GET'])
def load_current_data():
    """加载当前解析的数据"""
    try:
        saved_data = load_json_file(CURRENT_DATA_FILE)
        
        if saved_data is None:
            logger.info("📝 没有找到保存的当前数据")
            return jsonify({'error': '没有保存的数据'}), 404
        
        # 提取实际数据
        data = saved_data.get('data', {})
        logger.info(f"✅ 加载当前数据成功，功能组数: {len(data.get('featureGroups', []))}")
        
        return jsonify({
            'success': True,
            'data': data,
            'savedAt': saved_data.get('savedAt'),
            'version': saved_data.get('version', '1.0')
        })
        
    except Exception as e:
        logger.error(f"❌ 加载当前数据异常: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/jenkins/109/api/clearCurrentData', methods=['DELETE'])
def clear_current_data():
    """清除当前数据"""
    try:
        if os.path.exists(CURRENT_DATA_FILE):
            os.remove(CURRENT_DATA_FILE)
            logger.info("🗑️ 已删除当前数据文件")
        else:
            logger.info("📝 当前数据文件不存在，无需删除")
        
        return jsonify({
            'success': True,
            'message': '数据清除成功'
        })
        
    except Exception as e:
        logger.error(f"❌ 清除当前数据异常: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/jenkins/109/api/checkData', methods=['GET'])
def check_data():
    """检查是否有保存的数据"""
    try:
        exists = os.path.exists(CURRENT_DATA_FILE)
        logger.info(f"🔍 检查数据存在性: {exists}")
        
        return jsonify({
            'success': True,
            'exists': exists
        })
        
    except Exception as e:
        logger.error(f"❌ 检查数据异常: {str(e)}")
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/jenkins/109/api/getDataInfo', methods=['GET'])
def get_data_info():
    """获取数据统计信息"""
    try:
        saved_data = load_json_file(CURRENT_DATA_FILE)
        
        if saved_data is None:
            return jsonify({'error': '没有保存的数据'}), 404
        
        data = saved_data.get('data', {})
        group_count = len(data.get('featureGroups', []))
        
        # 计算feature数量
        feature_count = 0
        sub_feature_count = 0
        for group in data.get('featureGroups', []):
            features = group.get('features', [])
            feature_count += len(features)
            for feature in features:
                sub_features = feature.get('subFeatures', [])
                sub_feature_count += len(sub_features)
        
        info = {
            'source': data.get('source', '未知来源'),
            'savedAt': saved_data.get('savedAt'),
            'groupCount': group_count,
            'featureCount': feature_count,
            'subFeatureCount': sub_feature_count,
            'testLevels': data.get('testLevels', []),
            'version': saved_data.get('version', '1.0')
        }
        
        logger.info(f"📊 返回数据信息: {group_count}组, {feature_count}功能, {sub_feature_count}子功能")
        
        return jsonify({
            'success': True,
            'info': info
        })
        
    except Exception as e:
        logger.error(f"❌ 获取数据信息异常: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/jenkins/109/api/saveConfigs', methods=['POST'])
def save_configs():
    """保存配置列表"""
    try:
        request_data = request.get_json()
        
        if not request_data or 'configs' not in request_data:
            return jsonify({'error': '缺少配置字段'}), 400
        
        configs = request_data['configs']
        
        # 添加元数据
        save_data = {
            'configs': configs,
            'savedAt': datetime.now().isoformat(),
            'version': '1.0'
        }
        
        success = save_json_file(CONFIGS_FILE, save_data)
        
        if success:
            logger.info(f"💾 已保存配置，配置数量: {len(configs)}")
            return jsonify({
                'success': True,
                'message': '配置保存成功',
                'savedAt': save_data['savedAt']
            })
        else:
            return jsonify({'error': '保存配置失败'}), 500
            
    except Exception as e:
        logger.error(f"❌ 保存配置异常: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/jenkins/109/api/loadConfigs', methods=['GET'])
def load_configs():
    """加载配置列表"""
    try:
        saved_data = load_json_file(CONFIGS_FILE)
        
        if saved_data is None:
            logger.info("📝 没有找到保存的配置")
            return jsonify({
                'success': True,
                'configs': [],
                'savedAt': None
            })
        
        configs = saved_data.get('configs', [])
        logger.info(f"✅ 加载配置成功，配置数量: {len(configs)}")
        
        return jsonify({
            'success': True,
            'configs': configs,
            'savedAt': saved_data.get('savedAt'),
            'version': saved_data.get('version', '1.0')
        })
        
    except Exception as e:
        logger.error(f"❌ 加载配置异常: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500

@app.route('/jenkins/109/api/status', methods=['GET'])
def api_status():
    """API状态检查"""
    try:
        current_data_exists = os.path.exists(CURRENT_DATA_FILE)
        configs_exists = os.path.exists(CONFIGS_FILE)
        
        status_info = {
            'status': 'healthy',
            'timestamp': datetime.now().isoformat(),
            'dataDirectory': DATA_DIR,
            'currentDataExists': current_data_exists,
            'configsExists': configs_exists,
            'version': '1.0'
        }
        
        return jsonify(status_info)
        
    except Exception as e:
        logger.error(f"❌ 状态检查异常: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/jenkins/109/api/backup', methods=['POST'])
def backup_data():
    """备份数据（管理员功能）"""
    try:
        backup_dir = os.path.join(DATA_DIR, 'backups')
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        # 备份当前数据
        backup_files = []
        if os.path.exists(CURRENT_DATA_FILE):
            backup_current = os.path.join(backup_dir, f'current_data_{timestamp}.json')
            os.system(f'cp "{CURRENT_DATA_FILE}" "{backup_current}"')
            backup_files.append(backup_current)
        
        # 备份配置
        if os.path.exists(CONFIGS_FILE):
            backup_configs = os.path.join(backup_dir, f'configs_{timestamp}.json')
            os.system(f'cp "{CONFIGS_FILE}" "{backup_configs}"')
            backup_files.append(backup_configs)
        
        logger.info(f"💾 数据备份完成: {backup_files}")
        
        return jsonify({
            'success': True,
            'message': '备份完成',
            'backupFiles': backup_files,
            'timestamp': timestamp
        })
        
    except Exception as e:
        logger.error(f"❌ 备份异常: {str(e)}")
        return jsonify({'error': f'备份失败: {str(e)}'}), 500

@app.route('/jenkins/109/api/saveFile', methods=['POST'])
def save_file():
    """保存配置文件到服务器指定路径"""
    import platform
    import subprocess
    import tempfile
    
    try:
        request_data = request.get_json()
        
        if not request_data:
            return jsonify({'error': '缺少请求数据'}), 400
        
        file_name = request_data.get('fileName')
        content = request_data.get('content')
        
        if not file_name or not content:
            return jsonify({'error': '缺少文件名或内容'}), 400
        
        # 配置服务器保存路径 - 根据操作系统自动选择
        if platform.system() == 'Linux':
            # Linux环境 - 使用mount的路径
            server_path = '/home/enm/S/Version to V&V/AT'
        else:
            # Windows环境 - 使用网络路径
            server_path = r'\\netstore-ch\R&D TN China\R&D_Server\Version Management\Dev_Version\Version to V&V\AT'
        
        # 检查路径是否存在
        if not os.path.exists(server_path):
            # 如果网络路径不可访问，使用本地路径作为备选
            local_backup_path = os.path.join(DATA_DIR, 'generated_configs')
            if not os.path.exists(local_backup_path):
                os.makedirs(local_backup_path)
            
            file_path = os.path.join(local_backup_path, file_name)
            location_info = f"本地备份路径 (网络路径不可访问): {local_backup_path}"
            logger.warning(f"⚠️ 网络路径不可访问，使用本地备份: {server_path}")
        else:
            file_path = os.path.join(server_path, file_name)
            location_info = f"服务器路径: {server_path}"
        
        # 检查文件是否存在，如果存在则自动重命名
        final_file_name = file_name
        final_file_path = file_path
        counter = 1
        
        while os.path.exists(final_file_path):
            # 提取文件名（不含扩展名）和扩展名
            name_without_ext = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
            extension = '.' + file_name.rsplit('.', 1)[1] if '.' in file_name else ''
            
            # 生成新文件名
            final_file_name = f"{name_without_ext}({counter}){extension}"
            final_file_path = os.path.join(os.path.dirname(file_path), final_file_name)
            counter += 1
            
            logger.info(f"📝 文件已存在，尝试新文件名: {final_file_name}")
        
        # 保存文件
        try:
            # 尝试直接写入
            with open(final_file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            logger.info(f"📁 配置文件已保存: {final_file_path}")
            
            return jsonify({
                'success': True,
                'message': '文件保存成功',
                'fileName': final_file_name,  # 返回实际保存的文件名
                'originalFileName': file_name,  # 返回原始请求的文件名
                'filePath': final_file_path,
                'location': location_info,
                'savedAt': datetime.now().isoformat(),
                'fileSize': len(content.encode('utf-8')),
                'renamed': final_file_name != file_name  # 标识是否被重命名
            })
            
        except PermissionError:
            # Linux环境下尝试使用sudo权限
            if platform.system() == 'Linux':
                try:
                    
                    # 创建临时文件
                    with tempfile.NamedTemporaryFile(mode='w', delete=False, encoding='utf-8') as temp_file:
                        temp_file.write(content)
                        temp_path = temp_file.name
                    
                    # 使用sudo cp命令复制文件
                    result = subprocess.run([
                        'sudo', 'cp', temp_path, final_file_path
                    ], capture_output=True, text=True, timeout=30)
                    
                    # 清理临时文件
                    os.unlink(temp_path)
                    
                    if result.returncode == 0:
                        logger.info(f"📁 使用sudo权限保存文件成功: {final_file_path}")
                        return jsonify({
                            'success': True,
                            'message': '文件保存成功',
                            'fileName': final_file_name,
                            'originalFileName': file_name,
                            'filePath': final_file_path,
                            'location': location_info,
                            'savedAt': datetime.now().isoformat(),
                            'fileSize': len(content.encode('utf-8')),
                            'renamed': final_file_name != file_name,
                            'method': 'sudo'
                        })
                    else:
                        logger.error(f"sudo cp命令失败: {result.stderr}")
                        raise PermissionError("sudo权限操作失败")
                        
                except subprocess.TimeoutExpired:
                    logger.error("sudo命令超时")
                    raise PermissionError("sudo命令超时")
                except Exception as sudo_error:
                    logger.error(f"sudo操作异常: {str(sudo_error)}")
                    # 继续执行下面的本地备份逻辑
            # 权限错误，尝试本地备份
            local_backup_path = os.path.join(DATA_DIR, 'generated_configs')
            if not os.path.exists(local_backup_path):
                os.makedirs(local_backup_path)
            
            # 检查本地备份路径中的文件是否存在，如果存在则重命名
            backup_final_file_name = file_name
            backup_file_path = os.path.join(local_backup_path, backup_final_file_name)
            backup_counter = 1
            
            while os.path.exists(backup_file_path):
                name_without_ext = file_name.rsplit('.', 1)[0] if '.' in file_name else file_name
                extension = '.' + file_name.rsplit('.', 1)[1] if '.' in file_name else ''
                backup_final_file_name = f"{name_without_ext}({backup_counter}){extension}"
                backup_file_path = os.path.join(local_backup_path, backup_final_file_name)
                backup_counter += 1
                logger.info(f"📝 本地备份文件已存在，尝试新文件名: {backup_final_file_name}")
            
            with open(backup_file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            logger.warning(f"⚠️ 权限不足，文件已保存到本地备份: {backup_file_path}")
            
            return jsonify({
                'success': True,
                'message': '文件已保存到本地备份路径 (权限不足)',
                'fileName': backup_final_file_name,
                'originalFileName': file_name,
                'filePath': backup_file_path,
                'location': f"本地备份路径: {local_backup_path}",
                'savedAt': datetime.now().isoformat(),
                'fileSize': len(content.encode('utf-8')),
                'renamed': backup_final_file_name != file_name,
                'warning': '原路径权限不足，已保存到本地备份'
            })
            
    except Exception as e:
        logger.error(f"❌ 保存文件异常: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({'error': f'保存文件失败: {str(e)}'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'API端点不存在'}), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify({'error': '请求方法不允许'}), 405

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"❌ 内部服务器错误: {str(error)}")
    return jsonify({'error': '内部服务器错误'}), 500

if __name__ == '__main__':
    # 确保数据目录存在
    ensure_data_directory()
    
    # 启动信息
    logger.info("🚀 测试标签选择器 API 服务器启动中...")
    logger.info(f"📁 数据目录: {DATA_DIR}")
    logger.info(f"📄 当前数据文件: {CURRENT_DATA_FILE}")
    logger.info(f"⚙️ 配置文件: {CONFIGS_FILE}")
    logger.info("🌐 服务器配置：")
    logger.info("   - 监听地址: 0.0.0.0:5000 (所有接口)")
    logger.info("   - 前端地址: http://10.91.90.109:8080/jenkins//109/tools/web/tagSelecter.html")
    logger.info("   - API地址: http://10.91.90.109:5000/jenkins/109/api/")
    logger.info("   - 状态检查: http://10.91.90.109:5000/jenkins/109/api/status")
    
    # 启动Flask应用
    app.run(
        host='0.0.0.0',  # 监听所有接口，允许从任何地址访问
        port=5000,       # 端口号5000
        debug=False,     # 生产环境关闭调试模式
        threaded=True    # 支持多线程
    ) 