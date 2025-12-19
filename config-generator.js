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

    // ================================
    // 置顶状态服务器端数据持久化
    // ================================
    
    // 从服务器加载置顶状态
    async loadPinnedConfigs() {
        try {
            console.log('🔄 从服务器加载置顶状态...');
            const response = await fetch(`${this.baseUrl}/loadPinnedConfigs`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return { pinnedConfigs: [], source: 'server' };
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ 从服务器加载置顶状态成功:', result.pinnedConfigs.length, '个');
            return { 
                pinnedConfigs: result.pinnedConfigs || [], 
                source: 'server'
            };
        } catch (error) {
            console.error('❌ 从服务器加载置顶状态失败:', error);
            // 降级到localStorage
            const saved = localStorage.getItem('pinnedConfigs');
            const pinnedConfigs = saved ? JSON.parse(saved) : [];
            console.log('📝 降级使用本地localStorage置顶状态');
            return { 
                pinnedConfigs: pinnedConfigs, 
                source: 'local'
            };
        }
    }
    
    // 保存置顶状态到服务器
    async savePinnedConfigs(pinnedConfigs) {
        try {
            console.log('💾 保存置顶状态到服务器...', pinnedConfigs.length, '个');
            
            const response = await fetch(`${this.baseUrl}/savePinnedConfigs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    pinnedConfigs: pinnedConfigs
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ 置顶状态已保存到服务器');
                return { success: true, source: 'server' };
            } else {
                throw new Error(result.error || '服务器返回未知错误');
            }
        } catch (error) {
            console.error('❌ 保存置顶状态到服务器失败:', error);
            throw error; // 抛出错误让调用者处理降级逻辑
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
        
        this.selectedConfigs = []; // 当前选择的配置列表 (Multiple selection)
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
        
        // 置顶功能
        this.pinnedConfigs = []; // 存储置顶配置的ID列表
        this.pinnedDataSource = 'unknown'; // 置顶数据来源：'server', 'local', 'unknown'
        
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
            
            // 加载置顶状态
            await this.loadPinnedConfigs();
            
            // 清理无效的置顶配置
            if (this.savedConfigs.length > 0) {
                await this.cleanupPinnedConfigs();
            }
            
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
            const isSelected = this.selectedConfigs.some(c => c.id === config.id);
            const configDate = new Date(config.createdAt).toLocaleDateString();
            const totalTests = config.tests.length;
            const totalTime = config.tests.reduce((sum, test) => sum + test.time, 0);
            
            // 为悬停提示创建详细信息
            const itemTooltip = isSelected ? 
                'Click to deselect this configuration' : 
                'Click to select this configuration';
            
            // 配置名称的悬停提示（如果名称很长，显示完整名称；如果有描述，也显示描述）
            let nameTooltip = config.name;
            if (config.description) {
                nameTooltip = `${config.name}\n\n${config.description}`;
            }
            
            // 检查是否置顶
            const isPinned = this.pinnedConfigs.includes(config.id);
            const pinBtnClass = isPinned ? 'pinned' : '';
            const pinnedClass = isPinned ? 'pinned' : '';
            
            html += `
                <div class="config-selection-item ${isSelected ? 'selected' : ''} ${pinnedClass}" 
                     data-config-id="${config.id}"
                     title="${itemTooltip}">
                    <div class="config-item-header">
                        <div class="config-item-name" title="${this.escapeHtml(nameTooltip)}">
                            ${isPinned ? '<span class="pin-indicator"><i class="fas fa-thumbtack"></i>TOP</span>' : ''}${this.escapeHtml(config.name)}
                        </div>
                        <button class="pin-btn ${pinBtnClass}" 
                                data-config-id="${config.id}" 
                                title="${isPinned ? 'Unpin this configuration' : 'Pin this configuration to top'}"
                                onclick="event.stopPropagation(); window.configGenerator.handlePinToggle('${config.id}')">
                            <i class="fas fa-thumbtack"></i>
                        </button>
                    </div>
                    <div class="config-item-stats">
                        <div class="config-stats-left">
                            <span><i class="fas fa-tags"></i> ${totalTests} tags</span>
                            <span><i class="fas fa-clock"></i> ${this.formatTime(totalTime)}</span>
                        </div>
                        <div class="config-stats-right">
                            ${configDate}
                        </div>
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
        
        // 排序 - 置顶项优先
        this.filteredConfigs.sort((a, b) => {
            // 首先按置顶状态排序
            const aPinned = this.pinnedConfigs.includes(a.id);
            const bPinned = this.pinnedConfigs.includes(b.id);
            
            if (aPinned && !bPinned) return -1; // a置顶，b不置顶，a在前
            if (!aPinned && bPinned) return 1;  // b置顶，a不置顶，b在前
            
            // 如果两者置顶状态相同，按正常排序规则
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
                    this.showNotification(`Failed to generate configuration file: ${error.message}`, 'error');
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
        // 查找配置
        const config = this.savedConfigs.find(c => c.id === configId);
        if (!config) {
            console.error('配置未找到:', configId);
            return;
        }

        // 检查是否已选中
        const index = this.selectedConfigs.findIndex(c => c.id === configId);
        
        if (index > -1) {
            // 已选中，取消选择
            this.selectedConfigs.splice(index, 1);
            console.log('取消选择配置:', config.name);
            this.showNotification(`已取消配置: ${config.name}`, 'info');
        } else {
            // 未选中，添加到选择列表
            this.selectedConfigs.push(config);
            console.log('选择了配置:', config.name);
            this.showNotification(`已选择配置: ${config.name}`, 'success');
        }
        
        // 更新界面
        this.renderConfigList(); // 重新渲染以显示选中状态
        this.generateArgsFromConfigs();
        this.updatePreview();
        this.validateForm();
        this.updateInterfaceState();
    }
    
    generateArgsFromConfigs() {
        if (this.selectedConfigs.length === 0) {
            if (this.elements.argsPreview) {
                this.elements.argsPreview.innerHTML = `
                    <div class="args-placeholder">
                        <i class="fas fa-magic"></i>
                        <p>Arguments will be auto-generated from selected configurations</p>
                    </div>
                `;
            }
            if (this.elements.argsCount) {
                this.elements.argsCount.textContent = '0';
            }
            return;
        }
        
        // 从所有选择的配置生成 args 参数，并去重
        const argsSet = new Set();
        
        this.selectedConfigs.forEach(config => {
            config.tests.forEach(test => {
                // 根据特征名和测试类型生成 --include 参数
                const argName = `${test.testType}AND${test.featureName}`;
                argsSet.add(`--include ${argName}`);
            });
        });
        
        const args = Array.from(argsSet);
        
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
                        <p>No test selections found in selected configurations</p>
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
        if (this.selectedConfigs && this.selectedConfigs.length > 0) {
            // 收集所有args并去重
            const argsSet = new Set();
            this.selectedConfigs.forEach(config => {
                if (config.tests && config.tests.length > 0) {
                    config.tests.forEach(test => {
                        const argName = `${test.testType}AND${test.featureName}`;
                        argsSet.add(`- --include ${argName}`);
                    });
                }
            });
            
            if (argsSet.size > 0) {
                yaml += `args:\n`;
                argsSet.forEach(arg => {
                    yaml += `${arg}\n`;
                });
            }
        }
        
        return yaml;
    }
    
    validateForm() {
        const ftpPath = this.elements.ftpPath.value.trim();
        const hasConfig = this.selectedConfigs.length > 0;
        
        // 只需要 ftp_path 就可以生成文件，配置是可选的
        const isValid = !!ftpPath;
        
        this.elements.generateFile.disabled = !isValid;
        
        if (isValid) {
            const fileCount = this.selectedFiles.length;
            if (hasConfig) {
                if (this.elements.generateInfo) {
                    this.elements.generateInfo.innerHTML = `
                        <small><i class="fas fa-check-circle"></i> Ready to generate ${fileCount} configuration file${fileCount > 1 ? 's' : ''} with merged args</small>
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
            if (this.selectedConfigs.length > 0) {
                this.elements.configStatus.innerHTML = `
                    <span class="status-indicator success">
                        <i class="fas fa-check-circle"></i> ${this.selectedConfigs.length} selected
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
        
        if (this.selectedConfigs && this.selectedConfigs.length > 0) {
            if (this.selectedConfigs.length === 1) {
                // 单个配置：基于选择的配置名称生成文件名
                baseName = this.selectedConfigs[0].name
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '-')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '');
            } else {
                // 多个配置：使用 multi-config 前缀
                baseName = `multi-config-${this.selectedConfigs.length}`;
            }
        }
        
        // 添加时间戳
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 16).replace(/[:-]/g, '').replace('T', '-');
        const fileName = `${baseName}-${timestamp}`;
        
        if (this.elements.fileName) {
            this.elements.fileName.value = fileName;
            this.showNotification('智能文件名已生成', 'success');
        }
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
        
        this.showNotification(`File downloaded: ${fileName}`, 'success');
    }
    
    async saveToServer(content, fileName) {
        try {
            const result = await this.saveToServerSilent(content, fileName);
            
            console.log('✅ 文件保存成功:', result);
            
            let message = `File saved: ${result.fileName}`;
            this.showNotification(message, 'success');
            
            // 显示详细的保存结果
            this.showServerSaveResult(result);
            
        } catch (error) {
            console.error('❌ 保存到服务器失败:', error);
            this.showNotification(`Failed to save to server: ${error.message}`, 'error');
            
            // 询问用户是否要下载到本地作为备选方案
            if (confirm('Failed to save to server. Would you like to download the file locally instead?')) {
                this.downloadToLocal(content, fileName);
            }
        }
    }

    // 静默保存到服务器（不显示弹窗，返回结果）
    async saveToServerSilent(content, fileName) {
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
            return result;
        } else {
            throw new Error(result.error || '服务器返回未知错误');
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
                this.showNotification(`Failed to regenerate file: ${error.message}`, 'error');
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
        const saveResults = [];
        const saveLocation = document.querySelector('input[name="saveLocation"]:checked').value;
        
        // 显示进度提示
        this.showNotification(`Generating ${this.selectedFiles.length} configuration file${this.selectedFiles.length > 1 ? 's' : ''}...`, 'info');
        
        try {
            for (const fileName of this.selectedFiles) {
                const content = this.generateYAMLContentForFile(fileName);
                
                // 根据保存位置选择
                if (saveLocation === 'local') {
                    // 本地下载仍然需要前端处理重命名
                    const finalFileName = this.resolveDuplicateFileName(fileName, generatedFiles);
                    generatedFiles.push(finalFileName);
                    
                    this.downloadToLocal(content, finalFileName);
                    saveResults.push({
                        fileName: finalFileName,
                        originalFileName: fileName,
                        success: true,
                        location: 'local',
                        message: 'Downloaded successfully',
                        fileSize: content.length,
                        renamed: finalFileName !== fileName
                    });
                } else {
                    // 服务器保存让后端处理重命名
                    try {
                        const result = await this.saveToServerSilent(content, fileName);
                        saveResults.push({
                            fileName: result.fileName || fileName,  // 使用服务器返回的实际文件名
                            originalFileName: fileName,  // 原始请求的文件名
                            success: true,
                            location: result.location || 'server',
                            message: result.message || 'Saved successfully',
                            fileSize: result.fileSize || content.length,
                            filePath: result.filePath,
                            savedAt: result.savedAt,
                            warning: result.warning,
                            renamed: result.renamed || false  // 是否被重命名
                        });
                    } catch (error) {
                        saveResults.push({
                            fileName: fileName,
                            success: false,
                            location: 'server',
                            message: error.message || 'Save failed',
                            error: true
                        });
                    }
                }
            }
            
            // 显示批量保存结果
            this.showBatchSaveResult(saveResults, saveLocation);
            
        } catch (error) {
            console.error('❌ 批量生成文件时出错:', error);
            this.showNotification(`Batch generation failed: ${error.message}`, 'error');
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
        if (this.selectedConfigs && this.selectedConfigs.length > 0) {
            // 收集所有args并去重
            const argsSet = new Set();
            this.selectedConfigs.forEach(config => {
                if (config.tests && config.tests.length > 0) {
                    config.tests.forEach(test => {
                        const argName = `${test.testType}AND${test.featureName}`;
                        argsSet.add(`- --include ${argName}`);
                    });
                }
            });
            
            if (argsSet.size > 0) {
                yaml += `args:\n`;
                argsSet.forEach(arg => {
                    yaml += `${arg}\n`;
                });
            }
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
        let fileDisplayText = result.fileName;
        let renameInfo = '';
        
        if (result.renamed && result.originalFileName) {
            fileDisplayText = `${result.originalFileName} → ${result.fileName}`;
            renameInfo = `
                <div style="margin-bottom: 12px; padding: 8px; background: #fff3cd; border-radius: 4px; border-left: 3px solid #ffc107;">
                    <small style="color: #856404;">
                        <i class="fas fa-info-circle"></i> 
                        File was automatically renamed to avoid conflict
                    </small>
                </div>
            `;
        }
        
        this.showModal('File Saved Successfully', `
            <div style="margin-bottom: 12px;">
                <strong>File:</strong> ${fileDisplayText}
            </div>
            
            ${renameInfo}
            
            <div style="margin-bottom: 12px;">
                <strong>Size:</strong> ${this.formatFileSize(result.fileSize)}
            </div>
            
            <div style="margin-bottom: 16px;">
                <strong>Saved at:</strong> ${new Date(result.savedAt).toLocaleString()}
            </div>
            
            <div style="text-align: center; color: #28a745;">
                <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 8px;"></i>
                <div>Configuration file generated successfully!</div>
            </div>
        `, 'success');
    }

    // 显示批量保存结果
    showBatchSaveResult(saveResults, saveLocation) {
        const successCount = saveResults.filter(r => r.success).length;
        const failCount = saveResults.filter(r => !r.success).length;
        const totalCount = saveResults.length;
        
        const locationText = saveLocation === 'local' ? 'downloaded' : 'saved';
        
        // 构建结果列表
        const resultsList = saveResults.map(result => {
            const icon = result.success ? 
                '<i class="fas fa-check-circle" style="color: #28a745;"></i>' :
                '<i class="fas fa-times-circle" style="color: #dc3545;"></i>';
            
            // 简化消息显示，去掉技术细节
            let message = result.success ? 'Success' : 'Failed';
            if (result.success && result.fileSize) {
                message += ` (${this.formatFileSize(result.fileSize)})`;
            }
            if (!result.success && result.message && !result.message.includes('sudo')) {
                message = result.message;
            }
            
            // 如果文件被重命名，显示重命名信息
            let displayFileName = result.fileName;
            if (result.renamed && result.originalFileName) {
                displayFileName = `${result.originalFileName} → ${result.fileName}`;
                message += ' (renamed)';
            }
            
            return `
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 8px 12px;
                    margin: 4px 0;
                    background: ${result.success ? '#f8f9fa' : '#fff5f5'};
                    border-radius: 6px;
                    border-left: 3px solid ${result.success ? '#28a745' : '#dc3545'};
                ">
                    ${icon}
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">${displayFileName}</div>
                        <div style="font-size: 0.85rem; color: #666;">
                            ${message}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // 根据结果显示不同的标题
        let title = '';
        const renamedCount = saveResults.filter(r => r.renamed).length;
        
        if (failCount === 0) {
            title = totalCount === 1 ? 'File Generated Successfully' : 'Files Generated Successfully';
        } else if (successCount === 0) {
            title = 'Generation Failed';
        } else {
            title = 'Generation Completed';
        }
        
        const modalContent = `
            <div style="margin-bottom: 16px; text-align: center;">
                <div style="
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    background: ${failCount > 0 ? '#fff3cd' : '#d4edda'};
                    border-radius: 20px;
                    color: ${failCount > 0 ? '#856404' : '#155724'};
                    font-weight: 500;
                ">
                    <i class="fas fa-${failCount > 0 ? 'exclamation-triangle' : 'check-circle'}"></i>
                    ${successCount}/${totalCount} files ${locationText} successfully
                </div>
            </div>
            
            <div style="
                max-height: 300px;
                overflow-y: auto;
                margin-bottom: 16px;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                padding: 8px;
            ">
                ${resultsList}
            </div>
            
            ${renamedCount > 0 ? `
                <div style="
                    background: #d1ecf1;
                    color: #0c5460;
                    padding: 12px;
                    border-radius: 6px;
                    margin-bottom: 16px;
                    border-left: 4px solid #17a2b8;
                ">
                    <i class="fas fa-info-circle"></i>
                    <strong>Info:</strong> ${renamedCount} file${renamedCount > 1 ? 's were' : ' was'} automatically renamed to avoid conflicts
                </div>
            ` : ''}
            
            ${failCount > 0 ? `
                <div style="
                    background: #f8d7da;
                    color: #721c24;
                    padding: 12px;
                    border-radius: 6px;
                    margin-bottom: 16px;
                    border-left: 4px solid #dc3545;
                ">
                    <i class="fas fa-info-circle"></i>
                    <strong>Tip:</strong> Failed files can be regenerated or downloaded locally
                </div>
            ` : ''}
        `;
        
        this.showModal(title, modalContent, failCount > 0 ? 'warning' : 'success');
    }

    // 通用模态框显示方法
    showModal(title, content, type = 'info') {
        // 移除现有的模态框
        this.removeExistingModals();
        
        const iconMap = {
            success: 'fas fa-check-circle',
            warning: 'fas fa-exclamation-triangle',
            error: 'fas fa-times-circle',
            info: 'fas fa-info-circle'
        };
        
        const colorMap = {
            success: '#28a745',
            warning: '#ffc107',
            error: '#dc3545',
            info: '#17a2b8'
        };
        
        const modalId = 'custom-modal-' + Date.now();
        const backdropId = 'custom-backdrop-' + Date.now();
        const btnId = 'modal-confirm-btn-' + Date.now();
        
        const modalHtml = `
            <div id="${backdropId}" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div id="${modalId}" style="
                    background: white;
                    padding: 24px;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
                    max-width: 600px;
                    min-width: 400px;
                    max-height: 80vh;
                    overflow-y: auto;
                    border: 1px solid #e9ecef;
                    position: relative;
                ">
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        margin-bottom: 16px;
                        padding-bottom: 12px;
                        border-bottom: 1px solid #e9ecef;
                    ">
                        <i class="${iconMap[type]}" style="color: ${colorMap[type]}; font-size: 1.5rem;"></i>
                        <h3 style="margin: 0; color: #2c3e50;">${title}</h3>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        ${content}
                    </div>
                    
                    <div style="text-align: center;">
                        <button id="${btnId}" style="
                            background: var(--primary-color);
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 0.9rem;
                            font-weight: 500;
                        ">OK</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // 添加确认按钮点击事件
        document.getElementById(btnId).addEventListener('click', () => {
            this.removeModal(backdropId);
        });
        
        // 添加点击背景关闭功能
        document.getElementById(backdropId).addEventListener('click', (e) => {
            if (e.target.id === backdropId) {
                this.removeModal(backdropId);
            }
        });
        
        // 添加ESC键关闭功能
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.removeModal(backdropId);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // 移除模态框
    removeModal(backdropId) {
        const backdrop = document.getElementById(backdropId);
        if (backdrop) {
            backdrop.remove();
        }
    }

    // 移除所有现有模态框
    removeExistingModals() {
        const existingModals = document.querySelectorAll('[id^="custom-backdrop-"]');
        existingModals.forEach(modal => modal.remove());
    }
    
    // 移除数据来源指示器
    removeDataSourceIndicator() {
        const indicator = document.querySelector('.data-source-indicator');
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
            console.log('🗑️ 已移除数据来源指示器');
        }
    }
    
    // ================================
    // 置顶功能相关方法
    // ================================
    
    // 处理置顶按钮点击（同步包装器）
    handlePinToggle(configId) {
        // 使用异步包装器，避免onclick中的async问题
        this.togglePin(configId).catch(error => {
            console.error('❌ 置顶切换失败:', error);
            this.showNotification('置顶操作失败', 'error');
        });
    }
    
    // 切换配置的置顶状态
    async togglePin(configId) {
        console.log('切换置顶状态:', configId);
        
        const index = this.pinnedConfigs.indexOf(configId);
        if (index > -1) {
            // 已置顶，取消置顶
            this.pinnedConfigs.splice(index, 1);
            this.showNotification('已取消置顶', 'info');
            console.log('取消置顶:', configId);
        } else {
            // 未置顶，添加置顶
            this.pinnedConfigs.push(configId);
            this.showNotification('已置顶到列表顶部', 'success');
            console.log('添加置顶:', configId);
        }
        
        // 保存置顶状态（异步）
        await this.savePinnedConfigs();
        
        // 重新渲染列表以反映置顶状态变化
        this.renderConfigList();
    }
    
    // 从服务器/本地加载置顶配置（双重数据源）
    async loadPinnedConfigs() {
        try {
            console.log('🔄 开始加载置顶配置...');
            
            // 首先尝试从服务器加载
            const result = await this.serverDataManager.loadPinnedConfigs();
            this.pinnedConfigs = result.pinnedConfigs;
            this.pinnedDataSource = result.source;
            
            if (this.pinnedConfigs.length > 0) {
                const sourceText = result.source === 'server' ? '服务器' : '本地缓存';
                console.log(`✅ 成功从${sourceText}加载了 ${this.pinnedConfigs.length} 个置顶配置`);
            } else {
                console.log('📝 未找到保存的置顶配置');
            }
            
            // 如果从服务器加载成功，同步到本地作为备份
            if (result.source === 'server') {
                this.syncPinnedToLocal();
            }
            
        } catch (error) {
            console.error('❌ 加载置顶配置失败:', error);
            this.pinnedConfigs = [];
            this.pinnedDataSource = 'unknown';
        }
    }
    
    // 保存置顶配置到服务器/本地（双重数据持久化）
    async savePinnedConfigs() {
        try {
            console.log('💾 开始保存置顶配置...', this.pinnedConfigs.length, '个');
            
            // 首先尝试保存到服务器
            try {
                await this.serverDataManager.savePinnedConfigs(this.pinnedConfigs);
                this.pinnedDataSource = 'server';
                
                // 服务器保存成功后，同步到本地作为备份
                this.syncPinnedToLocal();
                
                console.log('✅ 置顶配置已保存到服务器并同步到本地');
                
            } catch (serverError) {
                console.warn('⚠️ 服务器保存失败，降级到本地保存:', serverError.message);
                
                // 服务器保存失败，降级到本地保存
                this.syncPinnedToLocal();
                this.pinnedDataSource = 'local';
                
                // 显示用户友好的警告信息
                this.showNotification('置顶设置已保存到本地，服务器连接异常', 'warning');
            }
            
        } catch (error) {
            console.error('❌ 保存置顶配置完全失败:', error);
            this.showNotification('保存置顶设置失败', 'error');
        }
    }
    
    // 同步置顶配置到本地存储（作为备份）
    syncPinnedToLocal() {
        try {
            localStorage.setItem('pinnedConfigs', JSON.stringify(this.pinnedConfigs));
            console.log('📝 置顶配置已同步到本地存储');
        } catch (error) {
            console.error('❌ 同步到本地存储失败:', error);
        }
    }
    
    // 清理不存在的置顶配置
    async cleanupPinnedConfigs() {
        const existingIds = this.savedConfigs.map(config => config.id);
        const originalLength = this.pinnedConfigs.length;
        
        this.pinnedConfigs = this.pinnedConfigs.filter(id => existingIds.includes(id));
        
        if (this.pinnedConfigs.length !== originalLength) {
            console.log(`🧹 清理了 ${originalLength - this.pinnedConfigs.length} 个无效的置顶配置`);
            await this.savePinnedConfigs();
        }
    }
    
    // 获取置顶配置的统计信息
    getPinnedStats() {
        return {
            total: this.pinnedConfigs.length,
            visible: this.filteredConfigs.filter(config => this.pinnedConfigs.includes(config.id)).length
        };
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