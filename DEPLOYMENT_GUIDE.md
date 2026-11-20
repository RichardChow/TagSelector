# 🚀 TXT文件生成器部署指南

## 📋 概述

本指南介绍如何配置和部署TXT文件生成器的真实服务器保存功能。

## 🔧 后端配置

### 1. 启动API服务器

```bash
# 方式1: 使用生产环境启动脚本
python start_server.py

# 方式2: 直接启动API服务器
python api_server.py
```

### 2. 服务器路径配置

在 `api_server.py` 中，配置文件保存路径：

```python
# 主要保存路径（网络共享路径）
server_path = r'\\netstore-ch\R&D TN China\R&D_Server\Version Management\Dev_Version\Version to V&V\AT'

# 备选本地路径（当网络路径不可访问时）
local_backup_path = os.path.join(DATA_DIR, 'generated_configs')
```

### 3. 路径权限设置

确保运行API服务器的用户具有以下权限：

- **网络路径写权限**: 对 `\\netstore-ch\...` 路径的写入权限
- **本地路径权限**: 对 `./data/generated_configs/` 的读写权限

## 🌐 网络配置

### API端点

- **基础URL**: `http://10.91.90.109:5000/jenkins/109/api`
- **保存文件**: `POST /saveFile`
- **状态检查**: `GET /status`

### 请求格式

```javascript
POST /jenkins/109/api/saveFile
Content-Type: application/json

{
    "fileName": "104.txt",
    "content": "ftp_path: \\\\netstore-ch\\...\nargs:\n- --include tag1"
}
```

### 响应格式

**成功响应:**
```javascript
{
    "success": true,
    "message": "文件保存成功",
    "fileName": "104.txt",
    "filePath": "\\\\netstore-ch\\...\\104.txt",
    "location": "服务器路径: \\\\netstore-ch\\...",
    "savedAt": "2024-01-15T14:30:25.123Z",
    "fileSize": 1234
}
```

**警告响应（权限不足时）:**
```javascript
{
    "success": true,
    "message": "文件已保存到本地备份路径 (权限不足)",
    "fileName": "104.txt",
    "filePath": "./data/generated_configs/104.txt",
    "location": "本地备份路径: ./data/generated_configs",
    "savedAt": "2024-01-15T14:30:25.123Z",
    "fileSize": 1234,
    "warning": "原路径权限不足，已保存到本地备份"
}
```

## 🛡️ 容错机制

### 1. 路径不可访问

当网络路径 `\\netstore-ch\...` 不可访问时：
- ✅ 自动降级到本地备份路径
- ⚠️ 显示警告信息给用户
- 📝 在服务器日志中记录问题

### 2. 权限不足

当对目标路径没有写权限时：
- ✅ 自动保存到本地备份路径 `./data/generated_configs/`
- ⚠️ 返回警告信息
- 📝 记录权限问题

### 3. 网络错误

当API服务器不可访问时：
- ❌ 前端显示错误信息
- 🔄 提供"下载到本地"的备选方案
- 💾 用户可选择本地下载

## 🔧 故障排除

### 常见问题

**1. 网络路径访问失败**
```
错误: [Errno 2] No such file or directory: '\\netstore-ch\...'
解决: 检查网络连接和路径映射
```

**2. 权限被拒绝**
```
错误: [Errno 13] Permission denied
解决: 配置正确的文件夹权限或联系IT管理员
```

**3. API服务器连接失败**
```
错误: Failed to fetch
解决: 检查服务器是否运行在 http://10.91.90.109:5000
```

### 调试步骤

1. **检查API服务器状态**
   ```bash
   curl http://10.91.90.109:5000/jenkins/109/api/status
   ```

2. **测试文件保存**
   ```bash
   curl -X POST http://10.91.90.109:5000/jenkins/109/api/saveFile \
        -H "Content-Type: application/json" \
        -d '{"fileName":"test.txt","content":"test content"}'
   ```

3. **查看服务器日志**
   ```bash
   tail -f api_server.log
   ```

## 📱 用户使用流程

### 1. 正常保存到服务器

1. 选择配置文件和环境文件
2. 填写必需的 `ftp_path`
3. 选择 "Save to Server" 选项
4. 点击 "Generate Files"
5. 查看详细的保存结果

### 2. 权限不足的情况

1. 系统尝试保存到服务器路径
2. 权限检查失败
3. 自动保存到本地备份路径
4. 显示警告信息，告知用户实际保存位置

### 3. 网络故障的情况

1. API调用失败
2. 显示错误信息
3. 弹出确认框：是否下载到本地
4. 用户可选择本地下载作为备选方案

## 🚀 部署检查清单

- [ ] Python API服务器正常运行
- [ ] 网络路径 `\\netstore-ch\...` 可访问
- [ ] 服务器进程具有目标路径写权限
- [ ] 前端配置指向正确的API地址
- [ ] 防火墙允许5000端口访问
- [ ] 测试保存功能正常工作
- [ ] 容错机制测试通过

## 📞 技术支持

如遇到部署或使用问题，请：

1. 查看服务器日志 `api_server.log`
2. 检查浏览器控制台错误信息
3. 使用curl测试API端点
4. 联系开发团队获取支持 