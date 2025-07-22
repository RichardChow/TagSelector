/**
 * 轻量级服务器数据管理类（专用于config-generator）
 * 避免与script.js中的ServerDataManager冲突
 */
class ConfigServerDataManager {
    constructor() {
        // Python API服务器地址
        this.baseUrl = 'http://10.91.90.109:5000/jenkins/109/api';
    }

    // 加载用户配置
    async loadConfigs() {
        try {
            const response = await fetch(`${this.baseUrl}/loadConfigs`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return { configs: [], source: 'server', isEmpty: true };
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ 从服务器加载配置');
            return { 
                configs: result.configs || [], 
                source: 'server',
                isEmpty: false
            };
        } catch (error) {
            console.error('❌ 从服务器加载配置失败:', error);
            // 降级到localStorage
            const saved = localStorage.getItem('testConfigs');
            const configs = saved ? JSON.parse(saved) : [];
            console.log('📝 降级使用本地localStorage');
            return { 
                configs: configs, 
                source: 'local',
                isEmpty: false
            };
        }
    }
}

/**
 * 配置文件生成器
 * 用于从保存的测试配置生成部署配置文件
 */

class ConfigFileGenerator {
    constructor() {
        // 服务器数据管理器
        this.serverDataManager = new ConfigServerDataManager();
        
        this.selectedConfig = null; // 当前选择的配置
        this.savedConfigs = []; // 保存的配置列表
        this.filteredConfigs = []; // 过滤后的配置列表
        this.yamlContent = ''; // 生成的YAML内容
        this.isPreviewReady = false; // 预览是否准备就绪
        
        // 分页和搜索相关
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.searchTerm = '';
        this.sortBy = 'createdAt'; // createdAt, name, testCount, totalTime
        this.sortOrder = 'desc'; // asc, desc
        
        // 环境文件选择
        this.selectedFiles = []; // 默认不选择任何文件
        
        // 表单字段引用
        this.elements = {
            // 配置选择
            configSelectionList: document.getElementById('configSelectionList'),
            configSearch: document.getElementById('configSearch'),
            clearConfigSearch: document.getElementById('clearConfigSearch'),
            refreshConfigs: document.getElementById('refreshConfigs'),
            totalConfigs: document.getElementById('totalConfigs'),
            
            // 环境文件选择器
            environmentSelector: document.getElementById('environmentSelector'),
            selectionSummary: document.getElementById('selectionSummary'),
            selectedCount: document.getElementById('selectedCount'),
            summaryFiles: document.getElementById('summaryFiles'),
            clearAllFiles: document.getElementById('clearAllFiles'),
            
            // 参数表单
            ftpPath: document.getElementById('ftpPath'),
            patchPath: document.getElementById('patchPath'),
            ftpRing: document.getElementById('ftpRing'),
            fileType: document.getElementById('fileType'),
            
            // 可选字段控制已移除
            
            // Args预览
            argsPreview: document.getElementById('argsPreview'),
            argsCount: document.getElementById('argsCount'),
            
            // YAML预览
            yamlPreview: document.getElementById('yamlPreview'),
            copyPreview: document.getElementById('copyPreview'),
            
            // 位置选择
            saveLocal: document.getElementById('saveLocal'),
            saveServer: document.getElementById('saveServer'),
            
            // 生成按钮
            generateFile: document.getElementById('generateFile'),
            generateInfo: document.getElementById('generateInfo'),
            
            // 状态指示器
            configStatus: document.getElementById('configStatus'),
            previewStatus: document.getElementById('previewStatus'),
            
            // 模态框
            generateResultModal: document.getElementById('generateResultModal'),
            closeResultModal: document.getElementById('closeResultModal'),
            downloadAgain: document.getElementById('downloadAgain'),
            generateAnother: document.getElementById('generateAnother'),
            
            // 结果显示
            resultFileName: document.getElementById('resultFileName'),
            resultLocation: document.getElementById('resultLocation'),
            resultFileSize: document.getElementById('resultFileSize'),
            resultTimestamp: document.getElementById('resultTimestamp')
        };
        
        // 检查关键元素是否存在
        this.checkRequiredElements();
        
        this.init();
    }
    
    checkRequiredElements() {
        // 检查关键元素是否存在，如果不存在则记录警告
        const requiredElements = [
            'environmentSelector', 'ftpPath', 'yamlPreview', 'generateFile'
        ];
        
        const missingElements = [];
        const foundElements = [];
        
        console.log('🔍 检查DOM元素是否存在...');
        
        requiredElements.forEach(elementName => {
            if (!this.elements[elementName]) {
                missingElements.push(elementName);
                console.error(`❌ 缺少元素: ${elementName}`);
            } else {
                foundElements.push(elementName);
                console.log(`✅ 找到元素: ${elementName}`);
            }
        });
        
        console.log(`📊 元素检查结果: ${foundElements.length}个存在, ${missingElements.length}个缺失`);
        
        if (missingElements.length > 0) {
            console.warn('⚠️ 配置生成器缺少以下关键元素:', missingElements);
            console.warn('⚠️ 某些功能可能无法正常工作');
        }
        
        // 额外检查所有elements
        console.log('🔍 检查所有elements对象...');
        Object.keys(this.elements).forEach(key => {
            if (!this.elements[key]) {
                console.warn(`⚠️ Element ${key} 为null或未找到`);
            }
        });
    }
    
    async init() {
        console.log('初始化配置文件生成器...');
        
        // 加载保存的配置
        await this.loadSavedConfigs();
        
        // 绑定事件监听器
        this.bindEventListeners();
        
        // 确保DOM渲染完成后再绑定环境选择器事件
        setTimeout(() => {
            console.log('延迟后开始绑定环境选择器事件...');
            this.bindEnvironmentSelectorEvents();
        }, 200);
        
        // 初始化界面状态
        this.updateInterfaceState();
        
        // 初始化自定义文件输入验证
        this.validateCustomFileInput();
        
        // 清理可能存在的数据来源指示器
        this.removeDataSourceIndicator();
        
        console.log('配置文件生成器初始化完成');
    }
    
    async loadSavedConfigs() {
        try {
            console.log('🔄 开始加载配置...');
            
            // 使用ServerDataManager进行双源读取（服务器优先，本地备用）
            const result = await this.serverDataManager.loadConfigs();
            this.savedConfigs = result.configs;
            this.dataSource = result.source;
            
            if (this.savedConfigs.length > 0) {
                const sourceText = result.source === 'server' ? '服务器' : '本地缓存';
                console.log(`✅ 成功从${sourceText}加载了 ${this.savedConfigs.length} 个保存的配置`);
                this.showNotification(`已从${sourceText}加载 ${this.savedConfigs.length} 个配置`, 'success');
            } else {
                const sourceText = result.source === 'server' ? '服务器和本地' : '本地';
                console.log(`📝 ${sourceText}都没有找到保存的配置`);
                this.showNotification('暂无保存的配置，请先在主页面创建一些测试配置', 'info');
            }
            
            // 更新界面
            this.renderConfigList();
            this.updateStats();
            
        } catch (error) {
            console.error('❌ 加载配置失败:', error);
            this.showNotification('加载配置失败，请检查网络连接', 'error');
            this.savedConfigs = [];
            this.dataSource = 'unknown';
        }
    }
    
    renderConfigList() {
        // 首先过滤和排序配置
        this.filterAndSortConfigs();
        
        const container = this.elements.configSelectionList;
        
        if (this.savedConfigs.length === 0) {
            container.innerHTML = `
                <div class="config-placeholder">
                    <i class="fas fa-folder-open"></i>
                    <p>No saved configurations found</p>
                    <small>Go back to the main page to create some test configurations first</small>
                </div>
            `;
            return;
        }
        
        if (this.filteredConfigs.length === 0) {
            container.innerHTML = `
                <div class="config-placeholder">
                    <i class="fas fa-search"></i>
                    <p>No configurations match your search</p>
                    <small>Try adjusting your search terms or clear the search to see all configurations</small>
                </div>
            `;
            return;
        }
        
        // 计算分页
        const totalPages = Math.ceil(this.filteredConfigs.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, this.filteredConfigs.length);
        const currentPageConfigs = this.filteredConfigs.slice(startIndex, endIndex);
        
        let html = '';
        
        // 添加工具栏
        html += this.renderToolbar();
        
        // 渲染配置项
        html += '<div class="config-items-container">';
        currentPageConfigs.forEach(config => {
            const isSelected = this.selectedConfig && this.selectedConfig.id === config.id;
            const configDate = new Date(config.createdAt).toLocaleDateString();
            const totalTests = config.tests.length;
            const totalTime = config.tests.reduce((sum, test) => sum + test.time, 0);
            
            html += `
                <div class="config-selection-item ${isSelected ? 'selected' : ''}" 
                     data-config-id="${config.id}"
                     title="${isSelected ? 'Click to deselect this configuration' : 'Click to select this configuration'}">
                    <div class="config-item-header">
                        <div class="config-item-name">${this.escapeHtml(config.name)}</div>
                        <div class="config-item-meta">${configDate}</div>
                    </div>
                    ${config.description ? `<div class="config-item-description">${this.escapeHtml(config.description)}</div>` : ''}
                    <div class="config-item-stats">
                        <span><i class="fas fa-tags"></i> ${totalTests} tags</span>
                        <span><i class="fas fa-clock"></i> ${this.formatTime(totalTime)}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        // 添加分页控制
        if (totalPages > 1) {
            html += this.renderPagination(totalPages);
        }
        
        container.innerHTML = html;
        
        // 绑定分页事件
        this.bindPaginationEvents();
        
        // 更新统计信息
        this.updateStats();
    }
    
    renderToolbar() {
        const totalCount = this.filteredConfigs.length;
        const totalConfigs = this.savedConfigs.length;
        
        return `
            <div class="config-toolbar">
                <div class="config-info">
                    <span class="config-count">
                        ${totalCount === totalConfigs ? 
                            `${totalCount} configs` : 
                            `${totalCount} of ${totalConfigs} configs`
                        }
                    </span>
                    ${this.searchTerm ? `<span class="search-term">Search: "${this.searchTerm}"</span>` : ''}
                </div>
                <div class="config-sort">
                    <select id="sortConfigs" class="sort-select">
                        <option value="createdAt:desc" ${this.sortBy === 'createdAt' && this.sortOrder === 'desc' ? 'selected' : ''}>Latest first</option>
                        <option value="createdAt:asc" ${this.sortBy === 'createdAt' && this.sortOrder === 'asc' ? 'selected' : ''}>Oldest first</option>
                        <option value="name:asc" ${this.sortBy === 'name' && this.sortOrder === 'asc' ? 'selected' : ''}>Name A-Z</option>
                        <option value="name:desc" ${this.sortBy === 'name' && this.sortOrder === 'desc' ? 'selected' : ''}>Name Z-A</option>
                        <option value="testCount:desc" ${this.sortBy === 'testCount' && this.sortOrder === 'desc' ? 'selected' : ''}>Most tags</option>
                        <option value="testCount:asc" ${this.sortBy === 'testCount' && this.sortOrder === 'asc' ? 'selected' : ''}>Least tags</option>
                    </select>
                </div>
            </div>
        `;
    }
    
    renderPagination(totalPages) {
        let html = '<div class="config-pagination">';
        
        // 上一页按钮
        html += `<button class="page-btn prev-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">
            <i class="fas fa-chevron-left"></i>
        </button>`;
        
        // 页码按钮
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        if (startPage > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (startPage > 2) {
                html += `<span class="page-ellipsis">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += `<span class="page-ellipsis">...</span>`;
            }
            html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }
        
        // 下一页按钮
        html += `<button class="page-btn next-btn" ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">
            <i class="fas fa-chevron-right"></i>
        </button>`;
        
        html += '</div>';
        return html;
    }
    
    filterAndSortConfigs() {
        // 过滤
        this.filteredConfigs = this.savedConfigs.filter(config => {
            if (!this.searchTerm) return true;
            
            const searchLower = this.searchTerm.toLowerCase();
            return config.name.toLowerCase().includes(searchLower) ||
                   (config.description && config.description.toLowerCase().includes(searchLower)) ||
                   config.tests.some(test => test.featureName.toLowerCase().includes(searchLower));
        });
        
        // 排序
        this.filteredConfigs.sort((a, b) => {
            let aVal, bVal;
            
            switch (this.sortBy) {
                case 'name':
                    aVal = a.name.toLowerCase();
                    bVal = b.name.toLowerCase();
                    break;
                case 'testCount':
                    aVal = a.tests.length;
                    bVal = b.tests.length;
                    break;
                case 'totalTime':
                    aVal = a.tests.reduce((sum, test) => sum + test.time, 0);
                    bVal = b.tests.reduce((sum, test) => sum + test.time, 0);
                    break;
                case 'createdAt':
                default:
                    aVal = new Date(a.createdAt).getTime();
                    bVal = new Date(b.createdAt).getTime();
                    break;
            }
            
            if (this.sortOrder === 'asc') {
                return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            } else {
                return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
            }
        });
    }
    
    bindPaginationEvents() {
        // 分页按钮
        this.elements.configSelectionList.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.currentTarget.dataset.page);
                this.goToPage(page);
            });
        });
        
        // 排序选择
        const sortSelect = this.elements.configSelectionList.querySelector('#sortConfigs');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                const [sortBy, sortOrder] = e.target.value.split(':');
                this.sortBy = sortBy;
                this.sortOrder = sortOrder;
                this.currentPage = 1; // 重置到第一页
                this.renderConfigList();
            });
        }
    }
    
    goToPage(page) {
        this.currentPage = page;
        this.renderConfigList();
        
        // 滚动到顶部
        this.elements.configSelectionList.scrollTop = 0;
    }
    
    bindEventListeners() {
        // 配置选择 - 检查元素是否存在
        if (this.elements.configSelectionList) {
            this.elements.configSelectionList.addEventListener('click', (e) => {
                const item = e.target.closest('.config-selection-item');
                if (item) {
                    const configId = item.dataset.configId;
                    this.selectConfig(configId);
                }
            });
        }
        
        // 搜索功能 - 检查元素是否存在
        if (this.elements.configSearch) {
            this.elements.configSearch.addEventListener('input', (e) => {
                this.handleConfigSearch(e.target.value);
            });
        }
        
        if (this.elements.clearConfigSearch) {
            this.elements.clearConfigSearch.addEventListener('click', () => {
                this.clearConfigSearch();
            });
        }
        
        if (this.elements.refreshConfigs) {
            this.elements.refreshConfigs.addEventListener('click', async () => {
                // 显示刷新中状态
                this.elements.refreshConfigs.disabled = true;
                this.elements.refreshConfigs.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
                
                await this.loadSavedConfigs();
                
                // 恢复按钮状态
                this.elements.refreshConfigs.disabled = false;
                this.elements.refreshConfigs.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
            });
        }
        
        // 可选字段控制已移除，直接监听字段变化
        
        // 表单字段变化 - 检查元素是否存在
        ['ftpPath', 'patchPath', 'ftpRing', 'fileType'].forEach(fieldName => {
            if (this.elements[fieldName]) {
                this.elements[fieldName].addEventListener('input', () => {
                    this.updatePreview();
                    this.validateForm();
                });
            }
        });
        
        // 文件名生成功能已移除，现在使用环境文件选择器
        
        // 预览复制 - 检查元素是否存在
        if (this.elements.copyPreview) {
            this.elements.copyPreview.addEventListener('click', () => {
                this.copyPreviewToClipboard();
            });
        }
        
        // 文件生成 - 检查元素是否存在
        if (this.elements.generateFile) {
            this.elements.generateFile.addEventListener('click', async () => {
                // 防止重复点击
                this.elements.generateFile.disabled = true;
                this.elements.generateFile.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
                
                try {
                    await this.generateConfigurationFile();
                } catch (error) {
                    console.error('❌ 生成配置文件失败:', error);
                    this.showNotification(`生成配置文件失败: ${error.message}`, 'error');
                } finally {
                    // 恢复按钮状态
                    this.elements.generateFile.disabled = false;
                    this.elements.generateFile.innerHTML = '<i class="fas fa-plus-circle"></i> <span>Generate Files</span>';
                }
            });
        }
        
        // 模态框控制 - 检查元素是否存在
        if (this.elements.closeResultModal) {
            this.elements.closeResultModal.addEventListener('click', () => {
                this.closeResultModal();
            });
        }
        
        if (this.elements.downloadAgain) {
            this.elements.downloadAgain.addEventListener('click', async () => {
                await this.downloadAgain();
            });
        }
        
        if (this.elements.generateAnother) {
            this.elements.generateAnother.addEventListener('click', () => {
                this.generateAnother();
            });
        }
        
        // 点击模态框外部关闭 - 检查元素是否存在
        if (this.elements.generateResultModal) {
            this.elements.generateResultModal.addEventListener('click', (e) => {
                if (e.target === this.elements.generateResultModal) {
                    this.closeResultModal();
                }
            });
        }

        // 自定义文件输入事件
        const customFileInput = document.getElementById('customFileName');
        const addCustomBtn = document.getElementById('addCustomFile');
        
        if (customFileInput && addCustomBtn) {
            // 输入框事件
            customFileInput.addEventListener('input', () => {
                this.validateCustomFileInput();
            });
            
            customFileInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addCustomFile();
                }
            });
            
            // 添加按钮事件
            addCustomBtn.addEventListener('click', () => {
                this.addCustomFile();
            });
        }
    }
    
    selectConfig(configId) {
        // 如果点击的是已选中的配置，则取消选择
        if (this.selectedConfig && this.selectedConfig.id === configId) {
            this.selectedConfig = null;
            console.log('取消选择配置');
            
            // 更新界面
            this.renderConfigList(); // 重新渲染以显示选中状态
            this.generateArgsFromConfig();
            this.updatePreview();
            this.validateForm();
            this.updateInterfaceState();
            
            this.showNotification('已取消配置选择', 'info');
            return;
        }
        
        // 查找配置
        const config = this.savedConfigs.find(c => c.id === configId);
        if (!config) {
            console.error('配置未找到:', configId);
            return;
        }
        
        this.selectedConfig = config;
        console.log('选择了配置:', config.name);
        
        // 更新界面
        this.renderConfigList(); // 重新渲染以显示选中状态
        this.generateArgsFromConfig();
        this.updatePreview();
        this.validateForm();
        this.updateInterfaceState();
        
        this.showNotification(`已选择配置: ${config.name}`, 'success');
    }
    
    generateArgsFromConfig() {
        if (!this.selectedConfig) {
            if (this.elements.argsPreview) {
                this.elements.argsPreview.innerHTML = `
                    <div class="args-placeholder">
                        <i class="fas fa-magic"></i>
                        <p>Arguments will be auto-generated from selected configuration</p>
                    </div>
                `;
            }
            if (this.elements.argsCount) {
                this.elements.argsCount.textContent = '0';
            }
            return;
        }
        
        // 从选择的配置生成 args 参数
        const args = [];
        this.selectedConfig.tests.forEach(test => {
            // 根据特征名和测试类型生成 --include 参数
            const argName = `${test.testType}${test.featureName}`;
            args.push(`--include ${argName}`);
        });
        
        // 更新界面
        if (this.elements.argsCount) {
            this.elements.argsCount.textContent = args.length.toString();
        }
        
        if (args.length > 0) {
            let html = '<div class="args-list">';
            args.forEach(arg => {
                html += `<div class="args-item">${this.escapeHtml(arg)}</div>`;
            });
            html += '</div>';
            if (this.elements.argsPreview) {
                this.elements.argsPreview.innerHTML = html;
            }
        } else {
            if (this.elements.argsPreview) {
                this.elements.argsPreview.innerHTML = `
                    <div class="args-placeholder">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>No test selections found in this configuration</p>
                    </div>
                `;
            }
        }
    }
    
    updatePreview() {
        const ftpPath = this.elements.ftpPath.value.trim();
        
        // 首先检查必需的 ftp_path
        if (!ftpPath) {
            this.elements.yamlPreview.innerHTML = `
                <div class="preview-placeholder">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>FTP Path is required</p>
                    <small>Please fill in the FTP path to generate preview</small>
                </div>
            `;
            this.elements.copyPreview.disabled = true;
            this.isPreviewReady = false;
            return;
        }
        
        // 生成YAML内容
        this.yamlContent = this.generateYAMLContent();
        
        // 更新预览
        this.elements.yamlPreview.innerHTML = `
            <div class="yaml-content">${this.escapeHtml(this.yamlContent)}</div>
        `;
        
        this.elements.copyPreview.disabled = false;
        this.isPreviewReady = true;
        
        // 更新预览状态
        this.updatePreviewStatus();
    }
    
    generateYAMLContent() {
        const ftpPath = this.elements.ftpPath.value.trim();
        let yaml = `ftp_path: ${ftpPath}\n`;
        
        // 添加可选字段 - 基于值判断而非checkbox
        
        // patch_path: 有值才输出
        const patchPath = this.elements.patchPath.value.trim();
        if (patchPath) {
            yaml += `patch_path: ${patchPath}\n`;
        }
        
        // ftp_ring: 只有选择'all'时才输出
        const ftpRing = this.elements.ftpRing.value;
        if (ftpRing === 'all') {
            yaml += `ftp_ring: ${ftpRing}\n`;
        }
        
        // file_type: 只有选择'bin'时才输出
        const fileType = this.elements.fileType.value;
        if (fileType === 'bin') {
            yaml += `file_type: ${fileType}\n`;
        }
        
        // args: 只有有选择的配置且有测试项时才输出
        if (this.selectedConfig && this.selectedConfig.tests.length > 0) {
            yaml += `args:\n`;
            this.selectedConfig.tests.forEach(test => {
                const argName = `${test.testType}${test.featureName}`;
                yaml += `- --include ${argName}\n`;
            });
        }
        
        return yaml;
    }
    
    validateForm() {
        const ftpPath = this.elements.ftpPath.value.trim();
        const hasConfig = this.selectedConfig !== null;
        
        // 只需要 ftp_path 就可以生成文件，配置是可选的
        const isValid = !!ftpPath;
        
        this.elements.generateFile.disabled = !isValid;
        
        if (isValid) {
            const fileCount = this.selectedFiles.length;
            if (hasConfig) {
                if (this.elements.generateInfo) {
                    this.elements.generateInfo.innerHTML = `
                        <small><i class="fas fa-check-circle"></i> Ready to generate ${fileCount} configuration file${fileCount > 1 ? 's' : ''} with args</small>
                    `;
                }
            } else {
                if (this.elements.generateInfo) {
                    this.elements.generateInfo.innerHTML = `
                        <small><i class="fas fa-check-circle"></i> Ready to generate ${fileCount} basic configuration file${fileCount > 1 ? 's' : ''}</small>
                    `;
                }
            }
        } else {
            if (this.elements.generateInfo) {
                this.elements.generateInfo.innerHTML = `
                    <small><i class="fas fa-info-circle"></i> FTP path is required to generate files</small>
                `;
            }
        }
    }
    
    updateInterfaceState() {
        // 更新配置状态 - 检查元素是否存在
        if (this.elements.configStatus) {
            if (this.selectedConfig) {
                this.elements.configStatus.innerHTML = `
                    <span class="status-indicator success">
                        <i class="fas fa-check-circle"></i> 
                    </span>
                `;
            } else {
                this.elements.configStatus.innerHTML = `
                    <span class="status-indicator">Ready to configure</span>
                `;
            }
        }
    }
    
    updatePreviewStatus() {
        if (this.elements.previewStatus) {
            if (this.isPreviewReady) {
                this.elements.previewStatus.innerHTML = `
                    <span class="status-indicator success">
                        <i class="fas fa-check-circle"></i> Preview ready
                    </span>
                `;
            } else {
                this.elements.previewStatus.innerHTML = `
                    <span class="status-indicator warning">
                        <i class="fas fa-exclamation-triangle"></i> Fill in FTP path
                    </span>
                `;
            }
        }
    }
    
    updateStats() {
        // 更新顶部统计信息 - 检查元素是否存在
        if (this.elements.totalConfigs) {
            const totalCount = this.filteredConfigs?.length || this.savedConfigs.length;
            const allCount = this.savedConfigs.length;
            
            if (totalCount === allCount) {
                this.elements.totalConfigs.textContent = totalCount.toString();
            } else {
                this.elements.totalConfigs.textContent = `${totalCount}/${allCount}`;
            }
        }
    }
    
    generateSmartFileName() {
        let baseName = 'config-deployment';
        
        if (this.selectedConfig) {
            // 基于选择的配置名称生成文件名
            baseName = this.selectedConfig.name
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        }
        
        // 添加时间戳
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 16).replace(/[:-]/g, '').replace('T', '-');
        const fileName = `${baseName}-${timestamp}`;
        
        this.elements.fileName.value = fileName;
        this.showNotification('智能文件名已生成', 'success');
    }
    
    async copyPreviewToClipboard() {
        try {
            await navigator.clipboard.writeText(this.yamlContent);
            this.showNotification('配置内容已复制到剪贴板', 'success');
        } catch (error) {
            console.error('复制失败:', error);
            // 降级处理
            this.fallbackCopyToClipboard(this.yamlContent);
        }
    }
    
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '-999px';
        textArea.style.left = '-999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showNotification('配置内容已复制到剪贴板', 'success');
            } else {
                throw new Error('Copy command failed');
            }
        } catch (error) {
            console.error('降级复制也失败:', error);
            this.showNotification('复制失败，请手动复制内容', 'error');
        } finally {
            document.body.removeChild(textArea);
        }
    }
    
    async generateConfigurationFile() {
        // 使用新的多文件生成逻辑
        await this.generateMultipleConfigurationFiles();
    }
    
    downloadToLocal(content, fileName) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // 清理URL对象
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        this.showNotification(`文件已下载: ${fileName}`, 'success');
    }
    
    async saveToServer(content, fileName) {
        try {
            console.log('🔄 正在保存文件到服务器:', fileName);
            
            // 调用真实的API
            const response = await fetch(`${this.serverDataManager.baseUrl}/saveFile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fileName: fileName,
                    content: content
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ 文件保存成功:', result);
                
                let message = `文件已保存: ${result.fileName}`;
                if (result.warning) {
                    message += `\n⚠️ ${result.warning}`;
                    this.showNotification(message, 'warning');
                } else {
                    this.showNotification(message, 'success');
                }
                
                // 显示详细的保存结果
                this.showServerSaveResult(result);
                
            } else {
                throw new Error(result.error || '服务器返回未知错误');
            }
            
        } catch (error) {
            console.error('❌ 保存到服务器失败:', error);
            this.showNotification(`保存到服务器失败: ${error.message}`, 'error');
            
            // 询问用户是否要下载到本地作为备选方案
            if (confirm('保存到服务器失败，是否要下载到本地作为备选方案？')) {
                this.downloadToLocal(content, fileName);
            }
        }
    }
    
    showResultModal(fileName, location, content) {
        const locationText = location === 'local' ? 'Local Download' : 'Server Storage';
        const fileSize = new Blob([content]).size;
        const timestamp = new Date().toLocaleString();
        
        if (this.elements.resultFileName) {
            this.elements.resultFileName.textContent = fileName;
        }
        if (this.elements.resultLocation) {
            this.elements.resultLocation.textContent = locationText;
        }
        if (this.elements.resultFileSize) {
            this.elements.resultFileSize.textContent = this.formatFileSize(fileSize);
        }
        if (this.elements.resultTimestamp) {
            this.elements.resultTimestamp.textContent = timestamp;
        }
        
        if (this.elements.generateResultModal) {
            this.elements.generateResultModal.style.display = 'flex';
        }
        
        // 存储当前生成的信息用于重新下载
        this.lastGenerated = {
            content: content,
            fileName: fileName,
            location: location
        };
    }
    
    closeResultModal() {
        if (this.elements.generateResultModal) {
            this.elements.generateResultModal.style.display = 'none';
        }
    }
    
    async downloadAgain() {
        if (this.lastGenerated) {
            try {
                if (this.lastGenerated.location === 'local') {
                    this.downloadToLocal(this.lastGenerated.content, this.lastGenerated.fileName);
                } else {
                    await this.saveToServer(this.lastGenerated.content, this.lastGenerated.fileName);
                }
            } catch (error) {
                console.error('❌ 重新生成文件失败:', error);
                this.showNotification(`重新生成文件失败: ${error.message}`, 'error');
            }
        }
    }
    
    generateAnother() {
        this.closeResultModal();
        // 可以选择重置表单或保持当前状态让用户修改
        this.showNotification('准备生成新的配置文件', 'info');
    }
    
    handleConfigSearch(searchTerm) {
        this.searchTerm = searchTerm.trim();
        this.currentPage = 1; // 重置到第一页
        
        if (this.searchTerm) {
            this.elements.clearConfigSearch.style.display = 'block';
        } else {
            this.elements.clearConfigSearch.style.display = 'none';
        }
        
        this.renderConfigList();
    }
    
    clearConfigSearch() {
        this.elements.configSearch.value = '';
        this.elements.clearConfigSearch.style.display = 'none';
        this.searchTerm = '';
        this.currentPage = 1;
        this.renderConfigList();
    }
    
    // 工具方法
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
    
    formatTime(minutes) {
        if (minutes < 60) {
            return `${minutes} min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }
    }
    
    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        const size = (bytes / Math.pow(1024, i)).toFixed(1);
        return `${size} ${sizes[i]}`;
    }
    
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        notification.className = `notification ${type} show`;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // 自动隐藏
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    // ================================
    // 环境文件选择器相关方法
    // ================================
    
    bindEnvironmentSelectorEvents() {
        console.log('开始绑定环境选择器事件...');
        
        // 折叠/展开环境
        const toggleBtns = document.querySelectorAll('.btn-toggle-env');
        console.log('找到切换按钮数量:', toggleBtns.length);
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const env = btn.dataset.env;
                console.log('点击切换按钮，环境:', env);
                this.toggleEnvironment(env);
            });
        });
        
        // 环境标题点击也可以折叠/展开
        const envTitles = document.querySelectorAll('.env-title');
        console.log('找到环境标题数量:', envTitles.length);
        envTitles.forEach(title => {
            title.addEventListener('click', (e) => {
                if (e.target.closest('.env-actions')) return; // 忽略动作按钮区域的点击
                const env = title.closest('.env-category').dataset.env;
                console.log('点击环境标题，环境:', env);
                this.toggleEnvironment(env);
            });
        });
        
        // 全选按钮
        const selectAllBtns = document.querySelectorAll('.btn-select-all');
        console.log('找到全选按钮数量:', selectAllBtns.length);
        selectAllBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const env = btn.dataset.env;
                console.log('点击全选按钮，环境:', env);
                this.selectAllFilesInEnvironment(env);
            });
        });
        
        // 文件选择复选框
        const checkboxes = document.querySelectorAll('.file-item input[type="checkbox"]');
        console.log('找到复选框数量:', checkboxes.length);
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                console.log('复选框状态改变');
                this.updateFileSelection();
            });
        });
        
        // 绑定清空所有文件按钮
        if (this.elements.clearAllFiles) {
            this.elements.clearAllFiles.addEventListener('click', () => {
                this.clearAllFileSelections();
            });
        }
        
        // 初始化显示
        console.log('初始化文件选择状态...');
        this.updateFileSelection();
    }
    
    toggleEnvironment(env) {
        console.log('切换环境:', env);
        const envCategory = document.querySelector(`.env-category[data-env="${env}"]`);
        
        if (!envCategory) {
            console.error('找不到环境分类元素:', env);
            return;
        }
        
        const content = envCategory.querySelector('.env-content');
        const toggleBtn = envCategory.querySelector('.btn-toggle-env i');
        
        if (!content || !toggleBtn) {
            console.error('找不到内容或切换按钮元素');
            return;
        }
        
        console.log('当前展开状态:', content.classList.contains('expanded'));
        
        if (content.classList.contains('expanded')) {
            content.classList.remove('expanded');
            toggleBtn.style.transform = 'rotate(0deg)';
        } else {
            content.classList.add('expanded');
            toggleBtn.style.transform = 'rotate(180deg)';
        }
        
        console.log('切换后展开状态:', content.classList.contains('expanded'));
    }
    
    selectAllFilesInEnvironment(env) {
        console.log('环境全选/取消全选:', env);
        const envCategory = document.querySelector(`.env-category[data-env="${env}"]`);
        
        if (!envCategory) {
            console.error('找不到环境分类元素:', env);
            return;
        }
        
        const checkboxes = envCategory.querySelectorAll('.file-item input[type="checkbox"]');
        console.log('找到复选框数量:', checkboxes.length);
        
        if (checkboxes.length === 0) {
            console.error('没有找到任何复选框');
            return;
        }
        
        // AT环境的特殊逻辑：全选时只选择基础文件
        if (env === 'at') {
            // 检查基础文件是否已全选
            const defaultFiles = ['104.txt', '105.txt', '106.txt'];
            const defaultCheckboxes = Array.from(checkboxes).filter(cb => {
                const fileName = cb.closest('.file-item').dataset.file;
                return defaultFiles.includes(fileName);
            });
            
            const allDefaultChecked = defaultCheckboxes.every(cb => cb.checked);
            console.log('AT环境基础文件是否全选:', allDefaultChecked);
            
            // 先取消所有选择
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            
            // 如果基础文件未全选，则选择基础文件
            if (!allDefaultChecked) {
                defaultCheckboxes.forEach(checkbox => {
                    checkbox.checked = true;
                });
                console.log('选择AT环境基础文件');
            } else {
                console.log('取消AT环境所有选择');
            }
        } else {
            // 其他环境保持原逻辑：全选/取消全选
            const allChecked = Array.from(checkboxes).every(cb => cb.checked);
            console.log('当前是否全选:', allChecked);
            
            checkboxes.forEach(checkbox => {
                checkbox.checked = !allChecked;
            });
            
            console.log('操作后状态:', !allChecked ? '全选' : '取消全选');
        }
        
        this.updateFileSelection();
    }
    
    updateFileSelection() {
        console.log('更新文件选择状态...');
        
        // 收集所有选中的复选框文件
        const selectedCheckboxes = document.querySelectorAll('.file-item input[type="checkbox"]:checked');
        console.log('选中的复选框数量:', selectedCheckboxes.length);
        
        const checkboxFiles = Array.from(selectedCheckboxes).map(cb => {
            return cb.closest('.file-item').dataset.file;
        });
        
        // 保留之前的自定义文件（不在预定义列表中的文件）
        const customFiles = this.selectedFiles.filter(file => {
            return !this.isPredefinedFile(file);
        });
        
        // 合并复选框文件和自定义文件，并去重
        this.selectedFiles = [...new Set([...checkboxFiles, ...customFiles])];
        
        console.log('复选框文件:', checkboxFiles);
        console.log('自定义文件:', customFiles);
        console.log('最终选中的文件:', this.selectedFiles);
        
        // 更新选择摘要
        this.updateSelectionSummary();
        
        // 更新预览和验证
        this.updatePreview();
        this.validateForm();
    }
    
    updateSelectionSummary() {
        const count = this.selectedFiles.length;
        
        // 检查元素是否存在
        if (this.elements.selectedCount) {
            this.elements.selectedCount.textContent = count;
        }
        
        // 控制清空按钮的显示/隐藏
        if (this.elements.clearAllFiles) {
            this.elements.clearAllFiles.style.display = count > 0 ? 'flex' : 'none';
        }
        
        if (this.elements.summaryFiles) {
            if (count === 0) {
                this.elements.summaryFiles.innerHTML = '<span class="no-selection">No files selected</span>';
            } else {
                const fileSpans = this.selectedFiles.map(file => 
                    `<span class="summary-file" data-file="${file}">
                        <span class="summary-file-name">${file}</span>
                        <button class="summary-file-remove" onclick="window.configGenerator.removeFile('${file}')" title="Remove ${file}">
                            <i class="fas fa-times"></i>
                        </button>
                    </span>`
                ).join('');
                this.elements.summaryFiles.innerHTML = fileSpans;
            }
        }
    }
    
    // 生成多个配置文件
    async generateMultipleConfigurationFiles() {
        if (this.selectedFiles.length === 0) {
            this.showNotification('Please select at least one file to generate', 'warning');
            return;
        }
        
        const ftpPath = this.elements.ftpPath.value.trim();
        if (!ftpPath) {
            this.showNotification('FTP path is required', 'error');
            return;
        }
        
        // 为每个选择的文件生成配置
        const generatedFiles = [];
        const saveLocation = document.querySelector('input[name="saveLocation"]:checked').value;
        
        // 显示进度提示
        this.showNotification(`开始生成 ${this.selectedFiles.length} 个配置文件...`, 'info');
        
        try {
            for (const fileName of this.selectedFiles) {
                const content = this.generateYAMLContentForFile(fileName);
                const finalFileName = this.resolveDuplicateFileName(fileName, generatedFiles);
                generatedFiles.push(finalFileName);
                
                // 根据保存位置选择
                if (saveLocation === 'local') {
                    this.downloadToLocal(content, finalFileName);
                } else {
                    await this.saveToServer(content, finalFileName);
                }
            }
            
            // 显示结果
            this.showMultiFileResult(generatedFiles);
            
        } catch (error) {
            console.error('❌ 批量生成文件时出错:', error);
            this.showNotification(`批量生成文件失败: ${error.message}`, 'error');
        }
    }
    
    generateYAMLContentForFile(fileName) {
        // 使用基础的YAML生成逻辑，但文件名特定
        const ftpPath = this.elements.ftpPath.value.trim();
        let yaml = `ftp_path: ${ftpPath}\n`;
        
        // 添加可选字段
        const patchPath = this.elements.patchPath.value.trim();
        if (patchPath) {
            yaml += `patch_path: ${patchPath}\n`;
        }
        
        const ftpRing = this.elements.ftpRing.value;
        if (ftpRing === 'all') {
            yaml += `ftp_ring: all\n`;
        }
        
        const fileType = this.elements.fileType.value;
        if (fileType === 'bin') {
            yaml += `file_type: bin\n`;
        }
        
        // 添加args（如果有选择的配置）
        if (this.selectedConfig && this.selectedConfig.tests.length > 0) {
            yaml += `args:\n`;
            this.selectedConfig.tests.forEach(test => {
                const argName = `${test.testType}${test.featureName}`;
                yaml += `- --include ${argName}\n`;
            });
        }
        
        return yaml;
    }
    
    resolveDuplicateFileName(fileName, existingFiles) {
        let finalName = fileName;
        let counter = 1;
        
        while (existingFiles.includes(finalName)) {
            // 添加优先级括号和数字，确保无空格
            const nameWithoutExt = fileName.replace('.txt', '');
            finalName = `${nameWithoutExt}(${counter}).txt`;
            counter++;
        }
        
        console.log(`文件名冲突解决: ${fileName} → ${finalName}`);
        return finalName;
    }
    
    showMultiFileResult(fileNames) {
        const count = fileNames.length;
        const fileList = fileNames.map(name => `<li>${name}</li>`).join('');
        
        this.showNotification(
            `Successfully generated ${count} configuration file${count > 1 ? 's' : ''}:<ul style="margin: 8px 0; padding-left: 20px;">${fileList}</ul>`, 
            'success'
        );
    }
    
    // 删除单个文件
    removeFile(fileName) {
        console.log('删除文件:', fileName);
        
        // 从selectedFiles数组中移除
        this.selectedFiles = this.selectedFiles.filter(file => file !== fileName);
        
        // 找到对应的复选框并取消选中
        const fileItems = document.querySelectorAll('.file-item');
        for (const item of fileItems) {
            if (item.dataset.file === fileName) {
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = false;
                }
                break;
            }
        }
        
        // 更新显示
        this.updateFileSelection();
        
        // 如果删除的文件可能影响自定义文件输入验证，重新验证
        this.validateCustomFileInput();
        
        console.log(`文件 ${fileName} 已删除，剩余文件:`, this.selectedFiles);
    }
    
    // 清空所有文件选择
    clearAllFileSelections() {
        console.log('清空所有文件选择');
        
        // 取消所有复选框的选中状态
        const checkboxes = document.querySelectorAll('.file-item input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // 清空selectedFiles数组
        this.selectedFiles = [];
        
        // 更新显示
        this.updateFileSelection();
        
        // 重新验证自定义文件输入
        this.validateCustomFileInput();
        
        console.log('所有文件选择已清空');
    }

    // 验证自定义文件名输入
    validateCustomFileInput() {
        const input = document.getElementById('customFileName');
        const addBtn = document.getElementById('addCustomFile');
        
        if (!input || !addBtn) return;
        
        let fileName = input.value.trim();
        
        // 检查是否需要自动添加.txt
        let finalFileName = fileName;
        if (fileName && !fileName.toLowerCase().endsWith('.txt')) {
            finalFileName = fileName + '.txt';
        }
        
        const isValid = this.isValidCustomFileName(finalFileName);
        
        // 更新按钮状态
        addBtn.disabled = !isValid;
        
        // 更新输入框样式和提示
        if (fileName && !isValid) {
            input.style.borderColor = '#dc3545';
            input.style.boxShadow = '0 0 0 2px rgba(220, 53, 69, 0.1)';
            
            // 动态更新placeholder显示预期的文件名
            if (fileName && finalFileName !== fileName) {
                input.setAttribute('title', `Will be saved as: ${finalFileName}`);
            } else {
                input.removeAttribute('title');
            }
        } else {
            input.style.borderColor = '';
            input.style.boxShadow = '';
            
            // 显示最终文件名预览
            if (fileName && finalFileName !== fileName) {
                input.style.borderColor = '#28a745';
                input.style.boxShadow = '0 0 0 2px rgba(40, 167, 69, 0.1)';
                input.setAttribute('title', `Will be saved as: ${finalFileName}`);
            } else {
                input.removeAttribute('title');
            }
        }
    }
    
    // 检查文件名是否有效
    isValidCustomFileName(fileName) {
        if (!fileName) return false;
        
        // 基本验证：长度和字符
        if (fileName.length < 1 || fileName.length > 50) return false;
        
        // 检查是否包含非法字符
        const invalidChars = /[<>:"/\\|?*]/g;
        if (invalidChars.test(fileName)) return false;
        
        // 确保以.txt结尾
        if (!fileName.toLowerCase().endsWith('.txt')) {
            return false;
        }
        
        // 检查是否已经存在
        const existsInPredefined = this.isPredefinedFile(fileName);
        const existsInSelected = this.selectedFiles.includes(fileName);
        
        if (existsInPredefined || existsInSelected) {
            return false;
        }
        
        return true;
    }
    
    // 检查是否是预定义文件
    isPredefinedFile(fileName) {
        const predefinedFiles = [
            '104.txt', '105.txt', '106.txt', // AT环境
            '2100.txt', '2300.txt', '2400.txt', '2507.txt', '2714.txt', // Data环境
            'ces.txt', 'ptp.txt', 'ces(10).txt', 'ptp(10).txt'// CES|PTP环境
        ];
        return predefinedFiles.includes(fileName);
    }
    
    // 添加自定义文件
    addCustomFile() {
        const input = document.getElementById('customFileName');
        if (!input) return;
        
        let fileName = input.value.trim();
        
        // 如果用户没有输入.txt扩展名，自动添加
        if (fileName && !fileName.toLowerCase().endsWith('.txt')) {
            fileName += '.txt';
        }
        
        if (!this.isValidCustomFileName(fileName)) {
            let errorMessage = 'Invalid filename. ';
            
            if (!fileName) {
                errorMessage += 'Please enter a filename.';
            } else if (this.isPredefinedFile(fileName)) {
                errorMessage += 'This file already exists in predefined lists.';
            } else if (this.selectedFiles.includes(fileName)) {
                errorMessage += 'This file is already selected.';
            } else {
                errorMessage += 'Please check the filename format.';
            }
            
            this.showNotification(errorMessage, 'error');
            return;
        }
        
        // 添加到选择列表
        console.log('添加前的selectedFiles:', this.selectedFiles);
        this.selectedFiles.push(fileName);
        console.log('添加后的selectedFiles:', this.selectedFiles);
        
        // 清空输入框
        input.value = '';
        this.validateCustomFileInput();
        
        // 更新显示
        this.updateFileSelection();
        
        this.showNotification(`Added custom file: ${fileName}`, 'success');
                console.log(`自定义文件已添加完成: ${fileName}`, this.selectedFiles);
    }
    
    // 显示服务器保存结果的详细信息
    showServerSaveResult(result) {
        const resultHtml = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                padding: 24px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                z-index: 10000;
                max-width: 500px;
                min-width: 350px;
                border: 1px solid #e9ecef;
            ">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid #e9ecef;
                ">
                    <i class="fas fa-check-circle" style="color: #28a745; font-size: 1.5rem;"></i>
                    <h3 style="margin: 0; color: #2c3e50;">文件保存成功</h3>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <strong>文件名:</strong> ${result.fileName}
                </div>
                
                <div style="margin-bottom: 12px;">
                    <strong>保存位置:</strong><br>
                    <code style="
                        background: #f8f9fa;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 0.85rem;
                        word-break: break-all;
                    ">${result.location}</code>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <strong>文件大小:</strong> ${this.formatFileSize(result.fileSize)}
                </div>
                
                <div style="margin-bottom: 16px;">
                    <strong>保存时间:</strong> ${new Date(result.savedAt).toLocaleString()}
                </div>
                
                ${result.warning ? `
                    <div style="
                        background: #fff3cd;
                        color: #856404;
                        padding: 12px;
                        border-radius: 6px;
                        border-left: 4px solid #ffc107;
                        margin-bottom: 16px;
                    ">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>注意:</strong> ${result.warning}
                    </div>
                ` : ''}
                
                <div style="text-align: center;">
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        background: var(--primary-color);
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.9rem;
                    ">确定</button>
                </div>
            </div>
            
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 9999;
            " onclick="this.nextElementSibling.remove(); this.remove();"></div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', resultHtml);
    }
    
    // 移除数据来源指示器
    removeDataSourceIndicator() {
        const indicator = document.querySelector('.data-source-indicator');
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
            console.log('🗑️ 已移除数据来源指示器');
        }
    }
 
}

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('🚨 Global JavaScript Error:', event.error);
    console.error('File:', event.filename, 'Line:', event.lineno);
    return false; // 不阻止默认错误处理
});

// 页面加载完成后初始化生成器
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM内容已加载，初始化配置生成器...');
    try {
        window.configGenerator = new ConfigFileGenerator();
        console.log('✅ 配置文件生成器初始化成功');
    } catch (error) {
        console.error('❌ 配置文件生成器初始化失败:', error);
        
        // 显示用户友好的错误信息
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f8d7da;
            color: #721c24;
            padding: 15px 20px;
            border: 1px solid #f5c6cb;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
        `;
        errorDiv.innerHTML = `
            <strong>⚠️ 初始化失败</strong><br>
            配置文件生成器初始化时出现错误，请刷新页面重试。<br>
            <small>错误详情请查看浏览器控制台</small>
        `;
        document.body.appendChild(errorDiv);
        
        // 5秒后自动移除错误提示
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
}); 