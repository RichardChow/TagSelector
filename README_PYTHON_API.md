# 测试标签选择器 - Python API 版本

## 🎯 概述

这是测试标签选择器的Python后端版本，使用Flask提供简单的文件存储服务。**所有用户共享同一份数据**，非常适合团队协作和临时展示使用。

## 🚀 快速开始

### Windows 用户

1. 双击运行 `start_api.bat`
2. 等待依赖安装完成
3. 看到"启动 API 服务器..."后，服务器就运行了

### Linux/macOS 用户

```bash
# 给脚本执行权限
chmod +x start_api.sh

# 运行启动脚本
./start_api.sh
```

### 手动启动（所有系统）

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动服务器
python start_server.py
```

## 📊 功能特性

✅ **共享数据存储** - 所有用户看到相同的数据
✅ **Excel文件解析** - 支持复杂的Excel格式
✅ **配置保存/加载** - 保存和分享测试配置
✅ **自动备份** - 数据自动备份防丢失
✅ **跨平台支持** - Windows、Linux、macOS
✅ **简单部署** - 无需复杂配置

## 🌐 访问地址

服务器启动后，访问以下地址：

- **前端页面**: `http://localhost:5000/index.html`
- **API状态**: `http://localhost:5000/jenkins/109/api/status`
- **数据检查**: `http://localhost:5000/jenkins/109/api/checkData`

## 📁 重要文件

| 文件 | 说明 |
|------|------|
| `api_server.py` | 主API服务器代码 |
| `start_server.py` | 生产启动脚本 |
| `requirements.txt` | Python依赖列表 |
| `start_api.sh` | Linux/macOS启动脚本 |
| `start_api.bat` | Windows启动脚本 |
| `script.js` | 前端代码（已修改为共享模式） |
| `data/` | 数据存储目录（自动创建） |
| `logs/` | 日志文件目录（自动创建） |

## 💾 数据存储

所有数据保存在 `data/` 目录下：

- `data/current_data.json` - 当前解析的Excel数据
- `data/configs.json` - 保存的测试配置
- `data/backups/` - 自动备份文件

## 🔄 与之前版本的区别

### 变更内容

1. **去除用户隔离** - 所有用户共享数据
2. **简化架构** - 使用Python Flask替代Java Servlet
3. **文件存储** - 直接使用JSON文件存储
4. **自动化脚本** - 提供跨平台启动脚本

### 前端改动

- 移除了用户ID相关逻辑
- API调用不再传递用户标识
- 保持了所有原有功能

## 🛠️ 开发和定制

### 修改端口

```bash
# 方式1：环境变量
export PORT=8080  # Linux/macOS
set PORT=8080     # Windows

# 方式2：修改代码
# 编辑 api_server.py 最后几行的 port=5000
```

### 修改数据目录

编辑 `api_server.py` 中的 `DATA_DIR` 变量：

```python
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'your_data_dir')
```

### 添加认证

如果需要简单的认证，可以在API端点添加认证检查：

```python
@app.before_request
def check_auth():
    # 添加您的认证逻辑
    pass
```

## 📝 日志查看

### 实时日志

```bash
# Linux/macOS
tail -f logs/api_server_$(date +%Y%m%d).log

# Windows
Get-Content logs\api_server_$(Get-Date -Format 'yyyyMMdd').log -Wait
```

### 错误排查

1. **服务器启动失败** - 检查端口是否被占用
2. **API访问失败** - 确认防火墙设置
3. **数据保存失败** - 检查磁盘空间和权限
4. **依赖安装失败** - 更新pip后重试

## 🎯 使用场景

这个版本特别适合：

- **团队演示** - 快速部署给同事展示
- **临时项目** - 不需要复杂的用户管理
- **数据分享** - 所有人都能看到最新数据
- **简单部署** - 最小化的技术栈要求

## 📞 支持

如果遇到问题：

1. 查看 `logs/` 目录下的日志文件
2. 检查 `http://localhost:5000/jenkins/109/api/status`
3. 确认 `data/` 目录权限正常
4. 重新运行启动脚本

## 🎉 开始使用

1. 运行启动脚本
2. 打开浏览器访问前端页面
3. 上传Excel文件解析数据
4. 开始选择和生成测试命令！

**注意**: 由于数据共享，一个用户的操作会影响到所有其他用户。 