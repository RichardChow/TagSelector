# 测试标签选择器 - Python API 服务器部署指南

## 🎯 概述

这是一个简化的Python Flask API服务器，为测试标签选择器提供共享数据存储服务。所有用户共享同一份数据，非常适合团队协作和临时展示。

## 📋 系统要求

- **Python**: 3.6 或更高版本
- **操作系统**: Linux, macOS, Windows
- **内存**: 至少 256MB 可用内存
- **磁盘**: 至少 100MB 可用空间
- **网络**: HTTP 端口访问权限

## 🚀 快速部署

### 方式一：使用自动脚本（推荐）

```bash
# 1. 下载所有文件到服务器目录
cd /path/to/your/project

# 2. 给启动脚本执行权限
chmod +x start_api.sh

# 3. 运行启动脚本
./start_api.sh
```

### 方式二：手动部署

```bash
# 1. 检查Python版本
python3 --version

# 2. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# 或 venv\Scripts\activate  # Windows

# 3. 安装依赖
pip install -r requirements.txt

# 4. 启动服务器
python start_server.py
```

## 📁 文件结构

部署完成后的目录结构：

```
project/
├── api_server.py          # 主API服务器
├── start_server.py        # 生产启动脚本
├── start_api.sh          # Linux/macOS自动启动脚本
├── requirements.txt       # Python依赖
├── index.html            # 前端页面
├── script.js             # 前端脚本（已修改为共享模式）
├── styles.css            # 样式文件
├── data.js              # 测试数据
├── venv/                # Python虚拟环境
├── data/                # 数据存储目录
│   ├── current_data.json # 当前解析的数据
│   ├── configs.json     # 保存的配置
│   └── backups/         # 备份文件
└── logs/                # 日志文件
    └── api_server_YYYYMMDD.log
```

## 🌐 API 端点

服务器提供以下REST API端点：

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/jenkins/109/api/saveCurrentData` | 保存当前解析的Excel数据 |
| `GET` | `/jenkins/109/api/loadCurrentData` | 加载保存的数据 |
| `DELETE` | `/jenkins/109/api/clearCurrentData` | 清除当前数据 |
| `GET` | `/jenkins/109/api/checkData` | 检查是否有保存的数据 |
| `GET` | `/jenkins/109/api/getDataInfo` | 获取数据统计信息 |
| `POST` | `/jenkins/109/api/saveConfigs` | 保存用户配置 |
| `GET` | `/jenkins/109/api/loadConfigs` | 加载配置列表 |
| `GET` | `/jenkins/109/api/status` | API服务状态检查 |
| `POST` | `/jenkins/109/api/backup` | 备份数据（管理员功能） |

## ⚙️ 配置选项

### 环境变量

可以通过环境变量配置服务器：

```bash
export HOST="0.0.0.0"      # 监听地址，默认0.0.0.0（所有接口）
export PORT="5000"         # 端口号，默认5000
export DEBUG="False"       # 调试模式，生产环境设为False
```

### 修改监听端口

```bash
# 方式1：环境变量
export PORT=8080
python start_server.py

# 方式2：直接修改api_server.py中的端口号
```

## 🔧 生产环境部署

### 使用systemd服务（Linux）

1. 创建服务文件：

```bash
sudo nano /etc/systemd/system/test-selector-api.service
```

2. 添加服务配置：

```ini
[Unit]
Description=Test Selector API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/your/project
Environment=PATH=/path/to/your/project/venv/bin
ExecStart=/path/to/your/project/venv/bin/python start_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. 启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable test-selector-api
sudo systemctl start test-selector-api
sudo systemctl status test-selector-api
```

### 使用Nginx反向代理

1. 安装Nginx：

```bash
sudo apt update
sudo apt install nginx
```

2. 创建Nginx配置：

```bash
sudo nano /etc/nginx/sites-available/test-selector
```

3. 添加配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为您的域名

    location /jenkins/109/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /path/to/your/project;
        index index.html;
        try_files $uri $uri/ =404;
    }
}
```

4. 启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/test-selector /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 📊 数据存储

### 数据格式

#### current_data.json 结构：
```json
{
  "data": {
    "featureGroups": [...],
    "testLevels": [...],
    "source": "Excel解析",
    "lastUpdated": "2024-01-01T00:00:00.000Z"
  },
  "savedAt": "2024-01-01T00:00:00.000Z",
  "version": "1.0"
}
```

#### configs.json 结构：
```json
{
  "configs": [
    {
      "id": "config_id",
      "name": "配置名称",
      "description": "配置描述",
      "tests": [...],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "savedAt": "2024-01-01T00:00:00.000Z",
  "version": "1.0"
}
```

### 备份策略

自动备份功能：

```bash
# 手动备份
curl -X POST http://localhost:5000/jenkins/109/api/backup

# 定时备份（cron）
# 每天凌晨2点备份
0 2 * * * curl -X POST http://localhost:5000/jenkins/109/api/backup
```

## 🔍 监控和日志

### 查看日志

```bash
# 实时查看日志
tail -f logs/api_server_$(date +%Y%m%d).log

# 查看错误日志
grep "ERROR" logs/api_server_*.log

# 查看API访问统计
grep "POST\|GET\|DELETE" logs/api_server_*.log | wc -l
```

### 健康检查

```bash
# 检查API状态
curl http://localhost:5000/jenkins/109/api/status

# 检查是否有数据
curl http://localhost:5000/jenkins/109/api/checkData
```

## 🛠️ 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   netstat -tlnp | grep :5000
   
   # 修改端口
   export PORT=5001
   python start_server.py
   ```

2. **权限问题**
   ```bash
   # 确保数据目录权限
   chmod -R 755 data/
   chown -R $USER:$USER data/
   ```

3. **依赖安装失败**
   ```bash
   # 升级pip
   pip install --upgrade pip
   
   # 重新安装依赖
   pip install -r requirements.txt --force-reinstall
   ```

4. **跨域问题**
   - 确保Flask-CORS已安装
   - 检查前端baseUrl配置是否正确

### 调试模式

开启调试模式获取详细错误信息：

```bash
export DEBUG=True
python start_server.py
```

## 🔒 安全建议

1. **生产环境关闭调试模式**
   ```bash
   export DEBUG=False
   ```

2. **使用反向代理**
   - 通过Nginx或Apache代理
   - 隐藏Flask服务器信息

3. **定期备份数据**
   - 设置自动备份
   - 存储备份到安全位置

4. **监控日志**
   - 定期检查错误日志
   - 设置日志轮转

## 📞 技术支持

如果遇到问题，请检查：

1. **日志文件**: `logs/api_server_YYYYMMDD.log`
2. **API状态**: `http://your-server:5000/jenkins/109/api/status`
3. **数据目录权限**: `data/` 目录是否可读写
4. **网络连接**: 前端是否能访问API端点

## 🎉 部署完成

部署成功后，您可以：

1. 访问 `http://your-server:5000/jenkins/109/api/status` 检查API状态
2. 打开前端页面开始使用
3. 上传Excel文件解析测试数据
4. 所有用户都能看到相同的数据和配置

**注意**: 由于采用共享数据模式，所有用户的操作都会影响到其他用户看到的数据。 