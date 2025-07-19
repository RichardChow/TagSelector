# 自动化测试标签选择器 - Excel解析版

## 📋 项目概述

这是一个专门为自动化测试团队设计的Web应用，支持从Excel文件解析测试功能数据，并提供直观的标签选择界面。支持多层级功能结构（Sub Feature Tag），能够生成RobotFramework测试命令。

## ✨ 主要功能特性

### 🔄 Excel数据解析
- **完全支持Excel格式**：支持.xlsx和.xls文件格式
- **智能列识别**：自动识别Excel表头，支持中英文列名
- **多工作表支持**：可指定工作表名称进行解析
- **数据验证**：完整的数据格式验证和错误提示

### 🗂️ 多层级功能结构
- **Sub Feature Tag支持**：完全支持子功能标签的层级结构
- **智能折叠展开**：主功能组和子功能组独立的折叠/展开控制
- **层级可视化**：清晰的视觉层级指示器和缩进
- **灵活数据结构**：支持有/无子功能的混合结构

### 🎯 测试标签选择
- **独立选择**：每个功能（包括子功能）独立选择测试深度
- **时间累计**：自动计算选中测试的总时间
- **智能显示**：大于60分钟自动转换为小时分钟格式
- **实时预览**：即时显示已选择的测试组合

### ⚡ 命令生成
- **RobotFramework语法**：生成标准的--include语法命令
- **一键复制**：支持一键复制生成的命令到剪贴板
- **组合优化**：智能的标签组合逻辑

## 📊 Excel数据格式要求

### 必需列（Required Columns）
| 列名 | 说明 | 示例 |
|------|------|------|
| Feature Group | 功能组名称 | MPLS-TP Tunnel and Service |
| Feature Tag | 功能标签名称 | tp_tunnels |
| Sub Feature Tag | 子功能标签（可为空） | basic_l2 |

### 可选列（Optional Columns）
| 列名 | 说明 | 示例 |
|------|------|------|
| Test Description | 测试描述 | TP隧道基础测试 |
| Suite Directory | 测试套件目录 | 024_TP_Tunnels |
| Owner | 负责人 | TangYanli |
| test_Qty | 测试用例数量 | 5 |
| test_time | 测试时间 | 10 或 1h 30m |
| confidence | 置信度 | high |
| remark | 备注信息 | 测试说明 |

### Excel数据示例
```
Feature Group               | Feature Tag  | Sub Feature Tag | Test Description    | Owner
MPLS-TP Tunnel and Service | tp_tunnels   |                 | TP隧道基础测试      | TangYanli
MPLS-TP Tunnel and Service | l2_service   | basic_l2        | L2基础服务测试      | TangYanli
MPLS-TP Tunnel and Service | l2_service   | advanced_l2     | L2高级服务测试      | TangYanli
Router Features            | bgp_routing  | bgp_ipv4        | BGP IPv4路由测试    | LiMing
```

## 🚀 使用方法

### 1. 准备Excel文件
- 确保第一行为表头
- 必须包含Feature Group和Feature Tag列
- Sub Feature Tag列为空表示该功能无子功能
- 时间格式支持纯数字（分钟）或"1h 30m"格式

### 2. 上传和解析
1. 点击设置按钮（⚙️）打开设置面板
2. 选择Excel文件
3. 确认工作表名称（默认Sheet1）
4. 点击"解析Excel文件"按钮
5. 查看解析预览确认数据正确

### 3. 选择测试标签
1. 展开需要的功能组
2. 对于有子功能的功能，点击功能名称展开子功能列表
3. 为每个功能选择测试深度（CI Night或Regression）
4. 查看右侧总时间统计

### 4. 生成命令
1. 点击"生成命令"按钮
2. 查看生成的RobotFramework命令
3. 点击"复制命令"按钮复制到剪贴板

## 🏗️ 项目结构

```
feature_web/
├── index.html          # 主页面文件
├── styles.css          # 样式文件（支持多层级显示）
├── script.js           # 主要JavaScript逻辑
├── data.js             # 数据结构和工具函数
├── README.md           # 项目文档
├── deploy-to-jenkins.sh    # Jenkins部署脚本
├── jenkins-deploy.yml      # Jenkins Pipeline配置
└── featureTag.xlsx     # Excel数据样例文件
```

## 🧪 测试功能

应用内置多个测试功能，可通过设置面板访问：

- **加载测试数据**：加载内置的示例数据
- **测试Excel解析**：使用模拟数据测试解析逻辑
- **测试多层级**：加载包含子功能的测试数据
- **测试子功能**：展开所有子功能组进行测试
- **查看当前数据**：显示详细的数据统计信息

## 🔧 技术架构

### 前端技术栈
- **HTML5**：现代化的语义化标记
- **CSS3**：响应式设计，支持多层级折叠动画
- **Vanilla JavaScript**：纯JavaScript实现，无框架依赖
- **SheetJS (XLSX.js)**：Excel文件解析库
- **Font Awesome**：图标库

### 核心功能模块
- **TestSelectorApp类**：主应用逻辑
- **Excel解析模块**：convertExcelToFeatureData()
- **多层级渲染**：createSubFeatureGroupElement()
- **数据管理**：支持多层级数据结构
- **UI控制**：折叠/展开状态管理

## 📱 响应式设计

- **桌面端**：完整功能展示，双列布局
- **平板端**：适配中等屏幕尺寸
- **移动端**：单列布局，触控优化

## 🎨 用户界面特性

### 视觉层级
- **功能组**：蓝色渐变背景，清晰的组标识
- **子功能组**：灰色背景，文件夹图标标识
- **子功能项**：浅色背景，缩进显示，箭头指示器

### 交互效果
- **平滑动画**：折叠/展开动画效果
- **悬停反馈**：鼠标悬停时的视觉反馈
- **状态指示**：清晰的选中状态显示
- **通知系统**：操作结果的即时通知

## 🔍 数据结构说明

### 功能组结构
```javascript
{
    id: 'group_id',
    name: '功能组名称',
    description: '功能组描述',
    features: [
        {
            id: 'feature_id',
            name: '功能名称',
            description: '功能描述',
            tests: {
                ci_night: { time: 10, description: 'CI测试' },
                regression: { time: 20, description: '回归测试' }
            },
            subFeatures: [
                // 子功能数组，结构与主功能相同
            ]
        }
    ]
}
```

## 📈 性能优化

- **智能渲染**：仅渲染可见的功能项
- **状态管理**：高效的展开/折叠状态跟踪
- **数据缓存**：解析后的数据本地缓存
- **异步处理**：Excel解析使用异步处理

## 🚀 部署说明

### Jenkins部署
1. 使用提供的`deploy-to-jenkins.sh`脚本
2. 或使用`jenkins-deploy.yml` Pipeline配置
3. 确保Jenkins环境支持Node.js和Web服务器

### 手动部署
1. 将所有文件上传到Web服务器
2. 确保支持静态文件访问
3. 访问index.html即可使用

## 🔧 配置说明

### Excel解析配置
- 支持自定义工作表名称
- 智能列名识别（支持中英文）
- 可扩展的列映射配置

### 时间格式支持
- 纯数字：如 `10`（表示10分钟）
- 时分格式：如 `1h 30m`（表示1小时30分钟）
- 小时格式：如 `2h`（表示2小时）

## 📝 版本历史

### v2.0.0 - Excel解析版本
- ✅ 完全移除wiki、word、pdf解析方式
- ✅ 新增Excel文件解析功能
- ✅ 支持Sub Feature Tag多层级结构
- ✅ 优化UI以支持层级显示
- ✅ 增强数据验证和错误处理
- ✅ 新增多个测试功能

### v1.0.0 - 初始版本
- 基础功能实现
- Wiki、Word、PDF解析支持

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 📞 支持和反馈

如有问题或建议，请：
1. 提交Issue到项目仓库
2. 联系开发团队
3. 查看内置的测试功能进行诊断

## 📄 许可证

本项目采用MIT许可证，详情请参阅LICENSE文件。

---

## 🎯 核心优势

1. **专门优化**：专为Excel数据源设计，解析效率高
2. **层级支持**：完整的Sub Feature Tag多层级支持
3. **用户友好**：直观的界面设计，操作简单
4. **扩展性强**：易于添加新的数据列和功能
5. **测试完备**：内置丰富的测试功能，便于验证

**让自动化测试标签选择变得更简单、更高效！** 🚀 


🚀 技术栈总览
🎨 前端技术
HTML5 - 页面结构和语义化标记
CSS3 - 现代化样式和响应式设计
CSS Grid & Flexbox布局
CSS变量 (:root)
渐变背景和动画效果
媒体查询响应式设计
Vanilla JavaScript (ES6+) - 核心业务逻辑
模块化类设计 (Class语法)
异步编程 (async/await, Promise)
事件驱动架构
DOM操作和事件处理
📚 外部库和框架
Font Awesome - 图标库
XLSX.js (SheetJS) - Excel文件解析
支持.xlsx/.xls文件读取
工作表数据处理
🔧 后端技术
Python 3.x - 后端API服务器
Flask - Web框架 (基于api_server.py分析)
RESTful API - 数据交互接口
💾 数据存储
浏览器本地存储
LocalStorage - 配置备份
SessionStorage - 会话数据
服务器端数据持久化
配置历史管理
当前数据保存
🛠 开发工具和配置
Jenkins - CI/CD集成
jenkins-deploy.yml
deploy-to-jenkins.sh
Git - 版本控制
Batch/Shell脚本 - 自动化部署
start_api.bat (Windows)
start_api.sh (Linux/macOS)
📄 文档和规范
Markdown - 文档编写
README.md
部署指南
集成说明
Microsoft Office格式
Excel (.xlsx) - 测试用例数据源
Word (.docx) - 需求文档
PDF - 自动化测试套件说明
🌐 Web技术标准
HTTP/HTTPS - 网络通信协议
JSON - 数据交换格式
CORS - 跨域资源共享
Fetch API - 现代HTTP客户端
📱 响应式和兼容性
Progressive Web App特性
移动端适配
触摸友好的UI
跨浏览器兼容
Chrome, Edge, Firefox
Webkit引擎优化
🔒 安全和错误处理
错误边界处理
Try-catch异常捕获
用户友好的错误提示
数据验证
输入验证和清理
Excel文件格式验证
⚡ 性能优化
懒加载和分页
DOM虚拟化 (大数据集处理)
缓存策略 (本地+服务器)
CSS动画优化 (transform, transition)
🧪 测试和调试
调试工具
debug-excel.html - Excel解析测试
test_api.html - API接口测试
Console日志系统
集成测试
test_integration.html
API端点测试
📊 架构模式
🏗 设计模式
MVC架构 - 模型-视图-控制器分离
模块化设计 - 功能解耦
事件驱动 - 响应式用户交互
状态管理 - 集中式数据管理
🔄 数据流
客户端 ↔ 服务器 双向数据同步
Excel解析 → 数据转换 → UI渲染
配置管理 - 导入/导出/历史记录