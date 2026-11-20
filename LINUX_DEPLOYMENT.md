# 🐧 Linux环境部署指南

## 📋 概述

本指南专门针对Linux服务器环境，处理Windows网络共享路径挂载和权限管理。

## 🗃️ 环境要求

- Linux服务器 (Ubuntu/CentOS/RHEL等)
- Python 3.6+
- sudo权限（用于挂载和文件操作）
- 网络访问Windows共享路径

## 📁 挂载Windows共享路径

### 1. 安装CIFS工具

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install cifs-utils

# CentOS/RHEL
sudo yum install cifs-utils
# 或 RHEL 8+
sudo dnf install cifs-utils
```

### 2. 创建挂载点

```bash
sudo mkdir -p "/home/enm/S/Version to V&V/AT"
```

### 3. 挂载网络路径

```bash
# 临时挂载（重启后失效）
sudo mount -t cifs \
    "//netstore-ch/R&D TN China/R&D_Server/Version Management/Dev_Version/Version to V&V/AT" \
    "/home/enm/S/Version to V&V/AT" \
    -o username=your_username,password=your_password,uid=$(id -u),gid=$(id -g)

# 或使用凭据文件（更安全）
sudo mount -t cifs \
    "//netstore-ch/R&D TN China/R&D_Server/Version Management/Dev_Version/Version to V&V/AT" \
    "/home/enm/S/Version to V&V/AT" \
    -o credentials=/home/enm/.smbcredentials,uid=$(id -u),gid=$(id -g)
```

### 4. 创建凭据文件（推荐）

```bash
# 创建凭据文件
sudo nano /home/enm/.smbcredentials

# 文件内容：
username=your_username
password=your_password
domain=your_domain

# 设置权限
sudo chmod 600 /home/enm/.smbcredentials
sudo chown enm:enm /home/enm/.smbcredentials
```

### 5. 自动挂载（开机自动）

```bash
# 编辑fstab
sudo nano /etc/fstab

# 添加以下行：
//netstore-ch/R&D\ TN\ China/R&D_Server/Version\ Management/Dev_Version/Version\ to\ V&V/AT /home/enm/S/Version\ to\ V&V/AT cifs credentials=/home/enm/.smbcredentials,uid=1000,gid=1000,iocharset=utf8,file_mode=0777,dir_mode=0777 0 0
```

## 🔐 权限配置

### 方案1: 修改挂载权限（推荐）

```bash
# 挂载时设置正确的权限
sudo mount -t cifs \
    "//netstore-ch/R&D TN China/R&D_Server/Version Management/Dev_Version/Version to V&V/AT" \
    "/home/enm/S/Version to V&V/AT" \
    -o credentials=/home/enm/.smbcredentials,uid=$(id -u),gid=$(id -g),file_mode=0664,dir_mode=0775
```

### 方案2: 配置sudo无密码（仅限cp命令）

```bash
# 编辑sudoers文件
sudo visudo

# 添加以下行（允许用户无密码使用cp命令）
enm ALL=(ALL) NOPASSWD: /bin/cp, /bin/mv, /bin/rm
```

### 方案3: 修改目录所有者

```bash
# 修改挂载点所有者
sudo chown -R enm:enm "/home/enm/S/Version to V&V/AT"
sudo chmod -R 755 "/home/enm/S/Version to V&V/AT"
```

## 🚀 部署步骤

### 1. 设置执行权限

```bash
chmod +x start_server_linux.sh
```

### 2. 运行启动脚本

```bash
# 使用Linux专用启动脚本
./start_server_linux.sh
```

### 3. 手动启动（备选）

```bash
# 如果启动脚本有问题，手动启动
python3 start_server.py
```

## 🧪 测试验证

### 1. 测试挂载点

```bash
# 检查挂载状态
mount | grep "Version to V&V"

# 测试读取权限
ls -la "/home/enm/S/Version to V&V/AT"

# 测试写入权限
echo "test" > "/home/enm/S/Version to V&V/AT/test.txt"
rm "/home/enm/S/Version to V&V/AT/test.txt"
```

### 2. 测试API服务器

```bash
# 检查服务器状态
curl http://10.91.90.109:5000/jenkins/109/api/status

# 测试文件保存API
curl -X POST http://10.91.90.109:5000/jenkins/109/api/saveFile \
     -H "Content-Type: application/json" \
     -d '{"fileName":"test.txt","content":"ftp_path: test"}'
```

### 3. 测试前端访问

```bash
# 确保前端可以访问后端
curl -H "Origin: http://10.91.90.109:8080" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://10.91.90.109:5000/jenkins/109/api/saveFile
```

## 🛠️ 故障排除

### 挂载问题

```bash
# 检查网络连接
ping netstore-ch

# 检查SMB服务
telnet netstore-ch 445

# 查看挂载错误
dmesg | tail -20

# 手动测试挂载
sudo mount -t cifs -v "//netstore-ch/..." "/home/enm/S/..." -o username=xxx
```

### 权限问题

```bash
# 检查当前用户权限
whoami
id

# 检查文件权限
ls -la "/home/enm/S/Version to V&V/AT"

# 检查sudo权限
sudo -l

# 测试sudo无密码
sudo -n true && echo "无密码sudo可用" || echo "需要密码"
```

### API服务器问题

```bash
# 检查端口监听
netstat -tlnp | grep 5000

# 检查进程
ps aux | grep python

# 查看日志
tail -f api_server.log

# 检查防火墙
sudo ufw status
sudo iptables -L
```

## 📋 生产环境建议

### 1. 服务化部署

创建systemd服务文件：

```bash
sudo nano /etc/systemd/system/txt-generator.service
```

内容：
```ini
[Unit]
Description=TXT File Generator API Server
After=network.target

[Service]
Type=simple
User=enm
WorkingDirectory=/path/to/TagSelector
ExecStart=/usr/bin/python3 /path/to/TagSelector/start_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable txt-generator
sudo systemctl start txt-generator
```

### 2. 日志管理

```bash
# 配置日志轮转
sudo nano /etc/logrotate.d/txt-generator

# 内容：
/path/to/TagSelector/api_server.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    sharedscripts
}
```

### 3. 监控脚本

```bash
#!/bin/bash
# monitor.sh - 监控服务状态

if ! curl -s http://10.91.90.109:5000/jenkins/109/api/status > /dev/null; then
    echo "API服务器异常，正在重启..."
    sudo systemctl restart txt-generator
    # 发送告警邮件或通知
fi
```

## 📞 支持联系

如遇到部署问题：

1. 查看API服务器日志：`tail -f api_server.log`
2. 检查系统日志：`journalctl -u txt-generator -f`
3. 查看挂载状态：`mount | grep cifs`
4. 测试网络连接：`ping netstore-ch` 