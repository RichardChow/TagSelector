# 🚀 方案一：独立Python API部署指南

## 📋 部署概览

**方案一：独立Python API服务器**
- **前端地址**: `http://10.91.90.109:8080/jenkins//109/tools/web/tagSelecter.html`
- **API地址**: `http://10.91.90.109:5000/jenkins/109/api/`
- **优势**: 简单、独立、易维护、不需要配置反向代理

## 🎯 网络架构

```
┌─────────────────────────────────────────────────┐
│                Jenkins 服务器                    │
│             10.91.90.109                        │
│                                                 │
│  ┌──────────────────┐    ┌──────────────────┐   │
│  │   Jenkins Web    │    │   Python API     │   │
│  │   Port: 8080     │    │   Port: 5000     │   │
│  │                  │    │                  │   │
│  │  tagSelecter.html├────┤  API Server      │   │
│  │  script.js       │HTTP│  data/           │   │
│  │  styles.css      │    │  logs/           │   │
│  └──────────────────┘    └──────────────────┘   │
└─────────────────────────────────────────────────┘
```

## 🚀 部署步骤

### 步骤1：准备Python环境

```bash
# 登录到Jenkins服务器
ssh user@10.91.90.109

# 进入工作目录
cd /home/enm/NPTI_CLI/  # 或您的实际目录

# 检查Python版本
python3 --version  # 需要3.6+
```

### 步骤2：上传文件

将以下文件上传到Jenkins服务器：

```
/home/enm/NPTI_CLI/api/  # 新建API目录
├── api_server.py        # Python API服务器
├── start_server.py      # 启动脚本
├── requirements.txt     # Python依赖
├── start_api.sh        # Linux启动脚本
└── README_PYTHON_API.md
```

同时更新前端文件：
```
/home/enm/NPTI_CLI/tools/web/
├── tagSelecter.html     # 重命名的前端页面
├── script.js           # 已更新baseUrl的脚本
├── styles.css          # 样式文件
└── data.js            # 测试数据
```

### 步骤3：安装Python依赖

```bash
# 进入API目录
cd /home/enm/NPTI_CLI/api/

# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 步骤4：启动API服务器

```bash
# 方法1：使用启动脚本（推荐）
chmod +x start_api.sh
./start_api.sh

# 方法2：手动启动
python start_server.py

# 方法3：后台运行
nohup python start_server.py > api_server.log 2>&1 &
```

### 步骤5：验证部署

```bash
# 检查API状态
curl http://10.91.90.109:5000/jenkins/109/api/status

# 预期响应：
# {
#   "status": "healthy",
#   "timestamp": "2024-01-01T12:00:00.000Z",
#   "dataDirectory": "/path/to/data",
#   "currentDataExists": false,
#   "configsExists": false,
#   "version": "1.0"
# }
```

## 🌐 访问地址

### 用户访问
- **前端页面**: `http://10.91.90.109:8080/jenkins//109/tools/web/tagSelecter.html`

### 管理员检查
- **API状态**: `http://10.91.90.109:5000/jenkins/109/api/status`
- **数据检查**: `http://10.91.90.109:5000/jenkins/109/api/checkData`

## 🔧 配置说明

### script.js配置
已自动配置为：
```javascript
this.baseUrl = 'http://10.91.90.109:5000/jenkins/109/api';
```

### 防火墙设置
确保5000端口开放：
```bash
# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload

# Ubuntu/Debian
sudo ufw allow 5000/tcp

# 检查端口监听
netstat -tlnp | grep :5000
```

## 📊 数据存储

### 数据目录结构
```
/home/enm/NPTI_CLI/api/data/
├── current_data.json    # 当前Excel数据（共享）
├── configs.json         # 保存的配置（共享）
└── backups/            # 自动备份
    ├── current_data_20240101_120000.json
    └── configs_20240101_120000.json
```

### 数据特点
- ✅ **共享数据**: 所有用户看到相同的数据
- ✅ **实时同步**: 一个用户上传Excel，其他用户立即可见
- ✅ **配置共享**: 保存的测试配置所有人都能使用
- ✅ **自动备份**: 防止数据丢失

## 🔄 服务管理

### 启动服务
```bash
cd /home/enm/NPTI_CLI/api/
source venv/bin/activate
python start_server.py
```

### 停止服务
```bash
# 查找进程
ps aux | grep api_server.py

# 停止进程
kill -9 <PID>
```

### 重启服务
```bash
# 停止服务
pkill -f api_server.py

# 启动服务
cd /home/enm/NPTI_CLI/api/
source venv/bin/activate
nohup python start_server.py > api_server.log 2>&1 &
```

### 设置系统服务（可选）

创建systemd服务：
```bash
sudo nano /etc/systemd/system/test-selector-api.service
```

```ini
[Unit]
Description=Test Selector API Server
After=network.target

[Service]
Type=simple
User=enm
WorkingDirectory=/home/enm/NPTI_CLI/api
Environment=PATH=/home/enm/NPTI_CLI/api/venv/bin
ExecStart=/home/enm/NPTI_CLI/api/venv/bin/python start_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable test-selector-api
sudo systemctl start test-selector-api
sudo systemctl status test-selector-api
```

## 📝 日志查看

### 查看实时日志
```bash
# API服务器日志
tail -f /home/enm/NPTI_CLI/api/logs/api_server_$(date +%Y%m%d).log

# 或者查看nohup日志
tail -f /home/enm/NPTI_CLI/api/api_server.log
```

### 常见日志信息
```
✅ 数据已保存到服务器
❌ 保存数据到服务器失败
📝 服务器中没有保存的数据
🔍 检查数据存在性: true
💾 已保存配置，配置数量: 3
```

## 🛠️ 故障排除

### 1. API服务器无法启动
```bash
# 检查端口占用
netstat -tlnp | grep :5000

# 检查Python依赖
pip list | grep Flask

# 查看详细错误
python start_server.py
```

### 2. 前端无法连接API
```bash
# 检查API状态
curl http://10.91.90.109:5000/jenkins/109/api/status

# 检查防火墙
sudo firewall-cmd --list-ports

# 检查CORS设置
curl -H "Origin: http://10.91.90.109:8080" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://10.91.90.109:5000/jenkins/109/api/saveCurrentData
```

### 3. 数据保存失败
```bash
# 检查数据目录权限
ls -la /home/enm/NPTI_CLI/api/data/

# 检查磁盘空间
df -h

# 手动测试API
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"data":{"test":"data"}}' \
     http://10.91.90.109:5000/jenkins/109/api/saveCurrentData
```

## ✅ 验证清单

部署完成后，请验证：

- [ ] API服务器正常启动（端口5000监听）
- [ ] API状态检查返回healthy
- [ ] 前端页面可以正常访问
- [ ] Excel文件上传和解析功能正常
- [ ] 数据保存和加载功能正常
- [ ] 配置保存和加载功能正常
- [ ] 多个用户可以看到相同的数据

## 🎉 完成

方案一部署完成后：

1. **用户访问**: `http://10.91.90.109:8080/jenkins//109/tools/web/tagSelecter.html`
2. **上传Excel**: 解析后的数据所有用户都能看到
3. **保存配置**: 配置会保存到服务器，其他用户也能使用
4. **跨设备同步**: 在任何设备上访问都是同一份数据

**注意**: 由于采用共享数据模式，一个用户的操作会影响到所有其他用户看到的数据。 