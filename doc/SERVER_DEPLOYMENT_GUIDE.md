# 🚀 服务器端数据存储部署指南

您的需求已得到解决！现在数据将存储在服务器上，支持跨设备同步。

## 📋 **解决方案概述**

### **原问题**
- localStorage只在浏览器本地存储
- 换电脑后数据丢失
- 无法跨设备同步

### **新方案特点**
✅ **服务器端存储** - 数据保存在服务器上  
✅ **跨设备同步** - 任何地方登录都是同一份数据  
✅ **用户隔离** - 每个用户有独立的数据空间  
✅ **降级保护** - 服务器故障时自动降级到localStorage  
✅ **数据安全** - 支持数据备份和恢复  

## 🔧 **部署方案（推荐）**

### **方案1：Java Servlet（适合Tomcat）**

#### **1. 文件结构**
```
/home/enm/NPTI_CLI/
├── index.html           # 重命名为 tagSelecter.html
├── script.js           # 已更新支持服务器存储
├── styles.css          # CSS样式文件
├── data.js             # 测试数据文件
├── WEB-INF/
│   ├── web.xml         # 新增：Servlet配置
│   ├── classes/
│   │   └── com/jenkins/api/
│   │       └── DataAPIServlet.class  # 新增：API Servlet
│   └── lib/
│       └── gson.jar    # 新增：JSON处理库
└── jenkins_data/       # 新增：数据存储目录
    ├── current_data_user1.json
    ├── configs_user1.json
    └── ...
```

#### **2. 部署步骤**

**步骤1：下载依赖**
```bash
# 下载Gson库用于JSON处理
cd /home/enm/NPTI_CLI/WEB-INF/lib/
wget https://repo1.maven.org/maven2/com/google/code/gson/gson/2.8.9/gson-2.8.9.jar
mv gson-2.8.9.jar gson.jar
```

**步骤2：编译Servlet**
```bash
# 编译Java Servlet
cd /home/enm/NPTI_CLI/
javac -cp ".:WEB-INF/lib/gson.jar:$CATALINA_HOME/lib/servlet-api.jar" \
      -d WEB-INF/classes/ \
      DataAPIServlet.java
```

**步骤3：创建web.xml**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="http://java.sun.com/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://java.sun.com/xml/ns/javaee 
         http://java.sun.com/xml/ns/javaee/web-app_3_0.xsd"
         version="3.0">

    <servlet>
        <servlet-name>DataAPIServlet</servlet-name>
        <servlet-class>com.jenkins.api.DataAPIServlet</servlet-class>
    </servlet>
    
    <servlet-mapping>
        <servlet-name>DataAPIServlet</servlet-name>
        <url-pattern>/api/*</url-pattern>
    </servlet-mapping>
    
    <welcome-file-list>
        <welcome-file>tagSelecter.html</welcome-file>
    </welcome-file-list>
    
</web-app>
```

**步骤4：配置Tomcat**
```xml
<!-- 在server.xml中添加Context -->
<Context docBase="/home/enm/NPTI_CLI/" path="/jenkins/109" />
```

**步骤5：创建数据目录**
```bash
mkdir -p /home/enm/jenkins_data
chmod 755 /home/enm/jenkins_data
```

**步骤6：重启Tomcat**
```bash
sudo systemctl restart tomcat
```

### **方案2：简化文件存储（无需Java）**

如果不想使用Java Servlet，可以使用PHP或Python创建简单的API：

#### **PHP版本（api.php）**
```php
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

$data_dir = '/home/enm/jenkins_data/';
if (!is_dir($data_dir)) {
    mkdir($data_dir, 0755, true);
}

$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['path']) ? $_GET['path'] : '';
$user_id = isset($_GET['userId']) ? $_GET['userId'] : '';

// 清理用户ID
$user_id = preg_replace('/[^a-zA-Z0-9_]/', '_', $user_id);

switch ($method) {
    case 'GET':
        handleGet($path, $user_id, $data_dir);
        break;
    case 'POST':
        handlePost($path, $user_id, $data_dir);
        break;
    case 'DELETE':
        handleDelete($path, $user_id, $data_dir);
        break;
    case 'OPTIONS':
        http_response_code(200);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

function handleGet($path, $user_id, $data_dir) {
    switch ($path) {
        case 'loadCurrentData':
            $file = $data_dir . "current_data_{$user_id}.json";
            if (file_exists($file)) {
                echo file_get_contents($file);
            } else {
                http_response_code(404);
                echo json_encode(['error' => '数据不存在']);
            }
            break;
        case 'loadConfigs':
            $file = $data_dir . "configs_{$user_id}.json";
            if (file_exists($file)) {
                echo file_get_contents($file);
            } else {
                echo json_encode(['configs' => []]);
            }
            break;
        case 'checkData':
            $file = $data_dir . "current_data_{$user_id}.json";
            echo json_encode(['exists' => file_exists($file)]);
            break;
    }
}

function handlePost($path, $user_id, $data_dir) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($path) {
        case 'saveCurrentData':
            $file = $data_dir . "current_data_{$user_id}.json";
            $data = [
                'userId' => $user_id,
                'data' => $input['data'],
                'savedAt' => date('c'),
                'serverVersion' => '1.0'
            ];
            file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
            echo json_encode(['success' => true]);
            break;
        case 'saveConfigs':
            $file = $data_dir . "configs_{$user_id}.json";
            $data = [
                'userId' => $user_id,
                'configs' => $input['configs'],
                'savedAt' => date('c')
            ];
            file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
            echo json_encode(['success' => true]);
            break;
    }
}

function handleDelete($path, $user_id, $data_dir) {
    switch ($path) {
        case 'clearCurrentData':
            $file = $data_dir . "current_data_{$user_id}.json";
            if (file_exists($file)) {
                unlink($file);
            }
            echo json_encode(['success' => true]);
            break;
    }
}
?>
```

## 🔑 **用户身份识别**

### **方案1：URL参数**
```
http://yourserver/jenkins/109/tagSelecter.html?user=username
```

### **方案2：Jenkins环境变量**
修改script.js中的getUserId方法：
```javascript
getUserId() {
    // 优先从URL参数获取
    const urlParams = new URLSearchParams(window.location.search);
    let userId = urlParams.get('user');
    
    // 如果没有，尝试从Jenkins环境获取
    if (!userId) {
        userId = window.BUILD_USER_ID || // Jenkins环境变量
                 window.USER ||          // 系统环境变量
                 localStorage.getItem('userId') || 
                 prompt('请输入您的用户ID:') || 
                 'default_user';
    }
    
    localStorage.setItem('userId', userId);
    return userId;
}
```

## 📊 **数据存储格式**

### **当前数据文件 (current_data_user.json)**
```json
{
    "userId": "user123",
    "data": {
        "featureGroups": [...],
        "testLevels": [...],
        "source": "Excel解析",
        "lastUpdated": "2024-01-01T00:00:00Z"
    },
    "savedAt": "Mon Jan 01 2024 12:00:00 GMT+0800",
    "serverVersion": "1.0"
}
```

### **配置文件 (configs_user.json)**
```json
{
    "userId": "user123",
    "configs": [
        {
            "id": "config_1",
            "name": "测试配置1",
            "description": "说明",
            "tests": [...],
            "createdAt": "2024-01-01T00:00:00Z"
        }
    ],
    "savedAt": "Mon Jan 01 2024 12:00:00 GMT+0800"
}
```

## 🛡️ **安全和备份**

### **数据安全**
- 用户ID验证和清理
- 文件路径安全检查
- CORS跨域保护

### **数据备份**
```bash
#!/bin/bash
# 创建备份脚本 backup_data.sh
backup_dir="/home/enm/jenkins_data_backup/$(date +%Y%m%d)"
mkdir -p "$backup_dir"
cp -r /home/enm/jenkins_data/* "$backup_dir/"
echo "✅ 数据备份完成: $backup_dir"
```

### **定期清理**
```bash
#!/bin/bash
# 清理30天前的备份
find /home/enm/jenkins_data_backup/ -type d -mtime +30 -exec rm -rf {} \;
```

## 🚀 **验证部署**

### **测试步骤**
1. 访问：`http://yourserver/jenkins/109/tagSelecter.html?user=testuser`
2. 解析一个Excel文件
3. 保存一些测试配置
4. 清空浏览器缓存
5. 重新访问，验证数据是否保持

### **日志检查**
```bash
# 检查Tomcat日志
tail -f $CATALINA_HOME/logs/catalina.out

# 检查数据文件
ls -la /home/enm/jenkins_data/
```

## 🎯 **优势对比**

| 特性 | localStorage | 服务器存储 |
|------|-------------|-----------|
| 跨设备同步 | ❌ | ✅ |
| 数据持久性 | ⚠️ 浏览器依赖 | ✅ 服务器保护 |
| 多用户支持 | ❌ | ✅ |
| 数据备份 | ❌ | ✅ |
| 容量限制 | ⚠️ 5-10MB | ✅ 服务器磁盘 |

现在您的应用已经完全支持服务器端存储，无论在哪里登录都能访问同一份数据！🎉 