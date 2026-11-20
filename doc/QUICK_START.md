# 🚀 快速开始指南 - 方案一：独立Python API

## 📋 概述

您已选择**方案一：独立Python API服务器**。这是最简单、最推荐的部署方式。

### 🌐 地址配置
- **Jenkins**: `http://10.91.90.109:8080/jenkins/`
- **前端页面**: `http://10.91.90.109:8080/jenkins//109/tools/web/tagSelecter.html`
- **Python API**: `http://10.91.90.109:5000/jenkins/109/api/`

## ⚡ 快速部署

### 1. 📁 文件准备

将以下文件上传到Jenkins服务器：

```bash
# API服务器文件（新建目录）
/home/enm/NPTI_CLI/api/
├── api_server.py           # ✅ 已创建
├── start_server.py         # ✅ 已创建  
├── requirements.txt        # ✅ 已创建
├── start_api.sh           # ✅ 已创建
└── test_api_local.py      # ✅ 已创建（用于测试）

# 前端文件（更新现有）
/home/enm/NPTI_CLI/tools/web/
├── tagSelecter.html       # 重命名index.html
├── script.js             # ✅ 已更新（baseUrl已配置）
├── styles.css            # ✅ 无需修改
└── data.js              # ✅ 无需修改
```

### 2. 🐍 安装Python依赖

```bash
# SSH登录Jenkins服务器
ssh user@10.91.90.109

# 进入API目录
cd /home/enm/NPTI_CLI/api/

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 3. 🚀 启动API服务器

```bash
# 方法1：使用脚本（推荐）
chmod +x start_api.sh
./start_api.sh

# 方法2：手动启动
python start_server.py

# 方法3：后台运行
nohup python start_server.py > api_server.log 2>&1 &
```

### 4. ✅ 验证部署

```bash
# 检查API状态
curl http://10.91.90.109:5000/jenkins/109/api/status

# 应该返回：
# {
#   "status": "healthy",
#   "timestamp": "...",
#   "dataDirectory": "...",
#   "currentDataExists": false,
#   "configsExists": false,
#   "version": "1.0"
# }
```

### 5. 🌐 访问前端

打开浏览器访问：
```
http://10.91.90.109:8080/jenkins//109/tools/web/tagSelecter.html
```

## 🧪 本地测试

如果要在本地测试API功能：

```bash
# 安装测试依赖
pip install requests

# 运行本地测试
python test_api_local.py
```

## 📊 功能特性

✅ **共享数据模式**
- 所有用户看到相同的Excel数据
- 一个用户上传Excel，其他用户立即可见
- 保存的测试配置所有人都能使用

✅ **数据持久化** 
- Excel解析数据保存在服务器
- 测试配置保存在服务器
- 自动备份防止数据丢失

✅ **跨设备同步**
- 任何设备访问都是同一份数据
- 无需登录或用户识别
- 简单易用

## 🔧 常用命令

### 服务管理
```bash
# 查看进程
ps aux | grep api_server.py

# 停止服务
pkill -f api_server.py

# 重启服务
pkill -f api_server.py && cd /home/enm/NPTI_CLI/api && source venv/bin/activate && nohup python start_server.py > api_server.log 2>&1 &

# 查看日志
tail -f /home/enm/NPTI_CLI/api/api_server.log
```

### 数据管理
```bash
# 查看数据文件
ls -la /home/enm/NPTI_CLI/api/data/

# 备份数据
cp /home/enm/NPTI_CLI/api/data/current_data.json /home/enm/NPTI_CLI/api/data/backups/

# 清空数据（如需要）
rm /home/enm/NPTI_CLI/api/data/current_data.json
rm /home/enm/NPTI_CLI/api/data/configs.json
```

## 🛠️ 故障排除

### API无法启动
```bash
# 检查端口占用
netstat -tlnp | grep :5000

# 检查Python版本
python3 --version

# 查看详细错误
cd /home/enm/NPTI_CLI/api && source venv/bin/activate && python start_server.py
```

### 前端无法访问API
```bash
# 检查防火墙
sudo firewall-cmd --list-ports

# 添加5000端口
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload

# 检查CORS
curl -H "Origin: http://10.91.90.109:8080" -X OPTIONS http://10.91.90.109:5000/jenkins/109/api/status
```

### 数据保存失败
```bash
# 检查目录权限
ls -la /home/enm/NPTI_CLI/api/data/

# 如果目录不存在，手动创建
mkdir -p /home/enm/NPTI_CLI/api/data

# 检查磁盘空间
df -h
```

## 📚 相关文档

- [DEPLOYMENT_PLAN1.md](./DEPLOYMENT_PLAN1.md) - 详细部署指南
- [README_PYTHON_API.md](./README_PYTHON_API.md) - Python API说明
- [PYTHON_API_DEPLOYMENT.md](./PYTHON_API_DEPLOYMENT.md) - 完整部署文档

## 🎉 完成

部署完成后，您就拥有了一个功能完整的测试标签选择器：

1. **Excel文件解析** - 上传Excel自动解析为功能标签
2. **测试配置管理** - 保存和分享测试配置
3. **命令生成** - 自动生成Robot Framework命令
4. **跨设备同步** - 所有用户共享同一份数据
5. **数据持久化** - 服务器端存储，不怕丢失

如有问题，请检查日志文件或参考故障排除部分。 