// Excel解析专用的测试标签选择器应用

// 服务器数据管理类（共享数据版本）
class ServerDataManager {
    constructor() {
        // 方案1：独立Python API服务器（推荐）
        this.baseUrl = 'http://10.91.90.109:5000/jenkins/109/api';
        
        // 方案2：如果Python API与Jenkins同端口，使用相对路径
        // this.baseUrl = '/jenkins/109/api';
        
        // 方案3：如果部署在其他机器，修改IP地址
        // this.baseUrl = 'http://your-api-server:5000/jenkins/109/api';
    }

    // 保存当前解析的数据
    async saveCurrentData(data) {
        try {
            const response = await fetch(`${this.baseUrl}/saveCurrentData`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data: data })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ 当前数据已保存到服务器');
            return result;
        } catch (error) {
            console.error('❌ 保存数据到服务器失败:', error);
            // 降级到localStorage作为备用
            localStorage.setItem('currentFeatureData', JSON.stringify(data));
            console.log('📝 降级保存到本地localStorage');
            throw error;
        }
    }

    // 加载当前解析的数据
    async loadCurrentData() {
        try {
            const response = await fetch(`${this.baseUrl}/loadCurrentData`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('📝 服务器中没有保存的数据');
                    return null;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ 从服务器加载已保存的数据');
            return result.data;
        } catch (error) {
            console.error('❌ 从服务器加载数据失败:', error);
            // 降级到localStorage作为备用
            const saved = localStorage.getItem('currentFeatureData');
            if (saved) {
                console.log('📝 降级从本地localStorage加载');
                return JSON.parse(saved);
            }
            return null;
        }
    }

    // 清除当前数据
    async clearCurrentData() {
        try {
            const response = await fetch(`${this.baseUrl}/clearCurrentData`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('✅ 服务器数据已清除');
            // 同时清除本地备用数据
            localStorage.removeItem('currentFeatureData');
        } catch (error) {
            console.error('❌ 清除服务器数据失败:', error);
            // 降级操作
            localStorage.removeItem('currentFeatureData');
            throw error;
        }
    }

    // 检查是否有保存的数据
    async hasSavedData() {
        try {
            const response = await fetch(`${this.baseUrl}/checkData`);
            if (!response.ok) {
                return false;
            }
            const result = await response.json();
            return result.exists;
        } catch (error) {
            console.error('❌ 检查服务器数据失败:', error);
            // 降级检查
            return localStorage.getItem('currentFeatureData') !== null;
        }
    }

    // 保存用户配置
    async saveConfigs(configs) {
        try {
            const response = await fetch(`${this.baseUrl}/saveConfigs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ configs: configs })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('✅ 配置已保存到服务器');
        } catch (error) {
            console.error('❌ 保存配置到服务器失败:', error);
            // 降级到localStorage
            localStorage.setItem('testConfigs', JSON.stringify(configs));
            throw error;
        }
    }

    // 加载用户配置
    async loadConfigs() {
        try {
            const response = await fetch(`${this.baseUrl}/loadConfigs`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    return [];
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ 从服务器加载配置');
            return result.configs || [];
        } catch (error) {
            console.error('❌ 从服务器加载配置失败:', error);
            // 降级到localStorage
            const saved = localStorage.getItem('testConfigs');
            return saved ? JSON.parse(saved) : [];
        }
    }

    // 获取数据统计信息
    async getDataInfo() {
        try {
            const response = await fetch(`${this.baseUrl}/getDataInfo`);
            
            if (!response.ok) {
                return null;
            }

            const result = await response.json();
            return result.info;
        } catch (error) {
            console.error('❌ 获取服务器数据信息失败:', error);
            // 降级处理
            const saved = localStorage.getItem('currentFeatureData');
            if (saved) {
                const data = JSON.parse(saved);
                return {
                    source: data.source || '本地数据',
                    savedAt: data.lastUpdated || new Date().toISOString(),
                    groupCount: data.featureGroups ? data.featureGroups.length : 0
                };
            }
            return null;
        }
    }
}

class TestSelectorApp {
    constructor() {
        this.selectedTests = [];
        this.serverDataManager = new ServerDataManager(); // 服务器数据管理器
        // 初始使用默认数据，异步加载服务器数据
        this.currentData = testFeatureData;
        this.expandedGroups = new Set();
        this.expandedSubGroups = new Set();
        this.tooltip = document.getElementById('tooltip');
        this.searchTerm = '';
        this.filteredData = null;
        this.savedConfigs = []; // 保存的配置列表
        this.configSearchTerm = ''; // 配置搜索项
        this.filteredConfigs = []; // 过滤后的配置列表
        this.configModalSearchTerm = ''; // 配置模态框搜索项
        this.filteredConfigsForModal = []; // 模态框过滤后的配置列表
        this.isExpandAllMode = false; // 标记是否处于"展开全部"状态
        this.pendingImportReplaceId = null; // 待替换的配置ID（用于单个配置导入）
        
        // ===== 活跃配置状态管理 =====
        this.activeConfig = null; // 当前活跃编辑的配置 {id, name, originalTests}
        this.hasUnsavedChanges = false; // 是否有未保存的更改
        
        this.init();
    }

    async init() {
        console.log('🚀 初始化测试标签选择器应用...');
        // 设置全局引用以支持描述展开/收起功能
        window.testApp = this;
        
        // 先渲染默认数据
        this.renderFeatureGroups();
        this.bindEventListeners();
        this.updateDisplay();
        
        // 异步加载服务器数据和配置
        try {
            await this.loadServerData();
            await this.loadServerConfigs();
        } catch (error) {
            console.warn('⚠️ 服务器数据加载失败，使用默认数据:', error);
        }
        
        await this.updateDataStatusDisplay(); // 更新数据状态显示
        console.log('✅ 应用初始化完成');
    }

    // 异步加载服务器数据
    async loadServerData() {
        try {
            const serverData = await this.serverDataManager.loadCurrentData();
            if (serverData) {
                this.currentData = serverData;
                this.renderFeatureGroups();
                this.updateDisplay();
                console.log('✅ 已从服务器加载数据');
                this.showNotification('已加载服务器数据', 'success');
            }
        } catch (error) {
            console.error('❌ 加载服务器数据失败:', error);
        }
    }

    // 异步加载服务器配置
    async loadServerConfigs() {
        try {
            this.savedConfigs = await this.serverDataManager.loadConfigs();
            this.filteredConfigs = [...this.savedConfigs];
            this.filteredConfigsForModal = [...this.savedConfigs];
            this.updateConfigHistoryDisplay();
            this.updateSaveButton();
            console.log('✅ 已从服务器加载配置');
        } catch (error) {
            console.error('❌ 加载服务器配置失败:', error);
        }
    }

    renderFeatureGroups() {
        const container = document.getElementById('featureGroups');
        if (!container) return;
        
        container.innerHTML = '';
        
        // 根据搜索状态决定渲染的数据
        const dataToRender = this.filteredData || this.currentData;
        if (!dataToRender?.featureGroups) return;

        dataToRender.featureGroups.forEach(group => {
            const groupElement = this.createGroupElement(group);
            container.appendChild(groupElement);
        });
    }

    createGroupElement(group) {
        const isExpanded = this.expandedGroups.has(group.id);
        const hasSubGroups = group.features.some(f => f.subFeatures?.length > 0);
        
        // 计算统计信息
        const stats = this.calculateGroupStats(group);
        const statsClass = stats.selected > 0 ? 'has-selection' : '';
        
        // 获取group级别的可用测试类型
        const availableTestLevels = this.getAvailableTestLevelsForGroup(group);
        const hasBatchSelect = availableTestLevels.length > 0;
        
        const groupDiv = document.createElement('div');
        groupDiv.className = `feature-group ${group._highlighted ? 'search-highlighted' : ''}`;
        groupDiv.dataset.groupId = group.id;

        // 高亮组名和描述
        const highlightedName = this.highlightSearchTerm(group.name);
        const highlightedDescription = group.description ? this.highlightSearchTerm(group.description) : '';

        groupDiv.innerHTML = `
            <div class="group-header ${isExpanded ? 'active' : ''}" data-group-id="${group.id}">
                <div class="group-header-left">
                    <div class="group-name">${highlightedName}</div>
                    ${group.description ? `<div class="group-description">${highlightedDescription}</div>` : ''}
                    ${hasSubGroups ? `<div class="group-info"><i class="fas fa-layer-group"></i> sub feature tag</div>` : ''}
                </div>
                <div class="group-header-right">
                    <div class="group-stats">
                        <span class="group-stats-item ${statsClass}">
                            <i class="fas fa-tags"></i>
                            Total: ${stats.total} | Selected: ${stats.selected}
                        </span>
                    </div>
                    ${hasBatchSelect ? `
                        <div class="batch-select-container">
                            <button class="batch-select-btn group-batch-select" data-group-id="${group.id}" title="Batch select the entire group">
                                <i class="fas fa-magic"></i>
                                <span>Batch Select</span>
                                <i class="fas fa-chevron-down dropdown-arrow"></i>
                            </button>
                            <div class="batch-select-dropdown" id="group_dropdown_${group.id}">
                                ${this.generateGroupBatchSelectOptions(group, availableTestLevels)}
                            </div>
                        </div>
                    ` : ''}
                    <i class="fas fa-chevron-down group-toggle ${isExpanded ? '' : 'collapsed'}"></i>
                </div>
            </div>
            <div class="features-list ${isExpanded ? 'expanded' : ''}" data-group-id="${group.id}">
                ${group.features.map(feature => this.createFeatureElement(feature, group.id)).join('')}
            </div>
        `;
        return groupDiv;
    }

    createFeatureElement(feature, groupId) {
        if (feature.subFeatures?.length > 0) {
            return this.createSubFeatureGroupElement(feature, groupId);
        }
        return this.createSimpleFeatureElement(feature, groupId);
    }

    createSubFeatureGroupElement(parentFeature, groupId) {
        const isExpanded = this.expandedSubGroups.has(parentFeature.id);
        
        // 检查有哪些可用的test_level选项
        const availableTestLevels = this.getAvailableTestLevelsForFeature(parentFeature);
        
        // 高亮功能名称
        const highlightedName = this.highlightSearchTerm(this.truncateText(parentFeature.name, 50));
        const featureClassWithHighlight = `sub-feature-group ${parentFeature._highlighted ? 'search-highlighted' : ''}`;
        
        // 生成唯一的功能ID用于折叠功能
        const parentToggleId = `feature_${parentFeature.id}`;
        
        return `
            <div class="${featureClassWithHighlight}" data-feature-id="${parentFeature.id}">
                <!-- 统一的feature header样式，与普通feature tag保持一致 -->
                <div class="feature-header" data-feature-id="${parentFeature.id}">
                    <div class="feature-header-main">
                        <div class="feature-name">
                            <i class="fas fa-folder-open parent-feature-icon" title="包含子功能"></i>
                            <span class="truncated-text" title="${parentFeature.name}">${highlightedName}</span>
                            <span class="sub-features-count">
                                <i class="fas fa-list"></i> ${parentFeature.subFeatures.length}
                            </span>
                        </div>
                        ${parentFeature.description ? `
                            <div class="feature-description">${this.truncateText(parentFeature.description, 80)}</div>
                        ` : ''}
                    </div>
                    <div class="feature-actions">
                        ${availableTestLevels.length > 0 ? `
                            <div class="batch-select-container">
                                <button class="batch-select-btn" data-parent-feature-id="${parentFeature.id}" title="Batch select the feature">
                                    <i class="fas fa-magic"></i>
                                    <span>Batch Select</span>
                                    <i class="fas fa-chevron-down dropdown-arrow"></i>
                                </button>
                                <div class="batch-select-dropdown" id="dropdown_${parentFeature.id}">
                                    ${this.generateBatchSelectOptions(parentFeature, availableTestLevels)}
                                </div>
                            </div>
                        ` : ''}
                        <button class="feature-expand-btn" 
                                onclick="window.testApp.toggleSubGroup('${parentFeature.id}')"
                                title="${isExpanded ? '收起子功能' : '展开子功能'}"
                                data-expanded="${isExpanded}">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                
                <!-- 子功能列表 -->
                <div class="sub-features-list ${isExpanded ? 'expanded' : ''}" data-feature-id="${parentFeature.id}">
                    ${parentFeature.subFeatures.map(subFeature => 
                        this.createSimpleFeatureElement(subFeature, groupId, parentFeature.id)
                    ).join('')}
                </div>
            </div>
        `;
    }

    createSimpleFeatureElement(feature, groupId, parentFeatureId = null) {
        const featureClass = parentFeatureId ? 'sub-feature-item' : 'feature-item';
        const dataAttributes = parentFeatureId ? 
            `data-feature-id="${feature.id}" data-group-id="${groupId}" data-parent-feature-id="${parentFeatureId}"` :
            `data-feature-id="${feature.id}" data-group-id="${groupId}"`;

        // 获取confidence信息（从任何一个非空的test level中提取）
        let confidence = '';
        if (feature.tests && this.currentData?.testLevels) {
            for (const testLevel of this.currentData.testLevels) {
                const testData = feature.tests[testLevel];
                if (testData && testData.confidence && !testData.isEmpty) {
                    confidence = testData.confidence;
                    break; // 使用第一个非空的confidence
                }
            }
        }

        // 处理功能详情信息（放到折叠内容中）
        let detailsHtml = '';
        if (feature.owner || feature.suiteName || feature.remark || confidence) {
            detailsHtml = `
                <div class="feature-details">
                    ${feature.owner ? `<span class="detail-item"><i class="fas fa-user"></i> ${feature.owner}</span>` : ''}
                    ${feature.suiteName ? `<span class="detail-item"><i class="fas fa-folder"></i> ${this.truncateText(feature.suiteName, 30)}</span>` : ''}
                    ${confidence ? `<span class="detail-item"><i class="fas fa-info-circle"></i> <span class="truncated-text" title="${confidence}">${this.truncateText(confidence, 30)}</span></span>` : ''}
                    ${feature.remark ? `<span class="detail-item"><i class="fas fa-comment"></i> <span class="truncated-text" title="${feature.remark}">${this.truncateText(feature.remark, 25)}</span></span>` : ''}
                </div>
            `;
        }

        // 检查是否有新格式的test_level数据
        const hasTestLevels = this.currentData?.testLevels && this.currentData.testLevels.length > 0;
        
        let testOptionsHtml = '';
        if (hasTestLevels) {
            // 新格式：支持多个test_level
            testOptionsHtml = this.createTestLevelOptions(feature, hasTestLevels);
        } else {
            // 兼容老格式：CI Night和Regression
            const ciNightTime = formatTime(feature.tests?.ci_night?.time || 5);
            const regressionTime = formatTime(feature.tests?.regression?.time || 10);
            
            testOptionsHtml = `
                <div class="feature-times">
                    <span class="time-ci"><i class="fas fa-moon"></i> CI Night: ${ciNightTime}</span>
                    <span class="time-regression"><i class="fas fa-sync-alt"></i> Regression: ${regressionTime}</span>
                </div>
                <div class="test-options">
                    <div class="tag-selector">
                        <input type="radio" 
                               id="ci_night_${feature.id}" 
                               name="test_${feature.id}" 
                               value="ci_night" 
                               data-feature-id="${feature.id}"
                               data-time="${feature.tests?.ci_night?.time || 5}">
                        <label for="ci_night_${feature.id}" class="tag-label ci-night">
                            <i class="fas fa-moon"></i> CI Night
                        </label>
                    </div>
                    <div class="tag-selector">
                        <input type="radio" 
                               id="regression_${feature.id}" 
                               name="test_${feature.id}" 
                               value="regression" 
                               data-feature-id="${feature.id}"
                               data-time="${feature.tests?.regression?.time || 10}">
                        <label for="regression_${feature.id}" class="tag-label regression">
                            <i class="fas fa-sync-alt"></i> Regression
                        </label>
                    </div>
                </div>
            `;
        }

        // 高亮功能名称
        const highlightedName = this.highlightSearchTerm(this.truncateText(feature.name, 50));
        const featureClassWithHighlight = `${featureClass} ${feature._highlighted ? 'search-highlighted' : ''}`;
        
        // 生成唯一的功能ID用于折叠功能
        const featureToggleId = `feature_${feature.id}`;
        
        return `
            <div class="${featureClassWithHighlight}" ${dataAttributes}>
                <div class="feature-header">
                    <div class="feature-header-main">
                        <div class="feature-name">
                            ${parentFeatureId ? '<i class="fas fa-angle-right" style="margin-right: 5px; color: #666;"></i>' : ''}
                            <span class="truncated-text" title="${feature.name}">${highlightedName}</span>
                        </div>
                    </div>
                    <button class="feature-expand-btn" 
                            onclick="window.testApp.toggleFeatureDetails('${featureToggleId}')"
                            title="查看详情"
                            data-expanded="false">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
                <div class="feature-details-container collapsed" id="${featureToggleId}">
                    <div class="feature-test-content">
                        ${detailsHtml}
                        ${testOptionsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    // 创建test_level选项
    createTestLevelOptions(feature, hasTestLevels) {
        if (!hasTestLevels || !this.currentData.testLevels) {
            return '';
        }

        let html = '<div class="test-levels-info">';
        
        // 显示test_level信息 - 显示所有test_level，包括空的
        this.currentData.testLevels.forEach(testLevel => {
            const testData = feature.tests[testLevel];
            if (testData) {
                const isEmpty = testData.isEmpty;
                const grayClass = isEmpty ? 'grayed-out' : '';
                const icon = isEmpty ? '<i class="fas fa-minus" style="color:#6c757d;"></i>' : '<i class="fas fa-circle" style="color:#6c757d; font-size: 0.6rem;"></i>';
                const time = isEmpty ? '' : formatTime(testData.time);
                const displayTime = time || (isEmpty ? '0M' : '0M');
                const description = testData.description || '';
                
                // 生成唯一的描述ID
                const descriptionId = `desc_${testLevel}_${feature.id}`;
                
                // 当数据为空时，将"无测试数据"放在同一行，否则单独显示描述
                let testLevelNameWithEmpty = '';
                let descriptionHtml = '';
                
                if (isEmpty) {
                    // 空数据时，将"无测试数据"放在test_level名称后面的括号中
                    testLevelNameWithEmpty = `${testLevel}<span class="test-level-empty-data">（无测试数据）</span>`;
                } else {
                    testLevelNameWithEmpty = testLevel;
                    if (description) {
                        // 有数据且有描述时，添加折叠的描述区域
                        descriptionHtml = `
                            <div class="test-level-description-container ${grayClass}" id="container_${descriptionId}">
                                <div class="test-level-description collapsed" id="${descriptionId}">
                                    ${this.formatTestDescriptionForCollapse(description, testLevel, feature.id, grayClass)}
                                </div>
                            </div>
                        `;
                    }
                }
                
                // 决定是否显示展开按钮
                const hasExpandButton = !isEmpty && description;
                const expandButtonHtml = hasExpandButton ? `
                    <button class="test-level-expand-btn" 
                            onclick="window.testApp.toggleTestLevelDescription('${descriptionId}')"
                            title="查看测试描述"
                            data-expanded="false">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                ` : '';
                
                html += `
                    <div class="test-level-info ${grayClass}">
                        <div class="test-level-header">
                            <div class="test-level-main">
                                <span class="test-level-icon">${icon}</span>
                                <span class="test-level-name">${testLevelNameWithEmpty}</span>
                                <span class="test-level-time">${displayTime}</span>
                            </div>
                            ${expandButtonHtml}
                        </div>
                        ${descriptionHtml}
                    </div>
                `;
            } else {
                // 如果testData不存在，显示为灰色空项，格式：weekly_regression（无测试数据）0分钟
                html += `
                    <div class="test-level-info grayed-out">
                        <div class="test-level-header">
                            <div class="test-level-main">
                                <span class="test-level-icon"><i class="fas fa-minus" style="color:#6c757d; font-size: 0.6rem;"></i></span>
                                <span class="test-level-name">${testLevel}<span class="test-level-empty-data">（无测试数据）</span></span>
                                <span class="test-level-time">0分钟</span>
                            </div>
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';
        
        // 创建选择选项 - 只显示有效的test_level选项
        html += '<div class="test-options">';
        this.currentData.testLevels.forEach(testLevel => {
            const testData = feature.tests[testLevel];
            if (testData && !testData.isEmpty) {
                const originalName = this.getOriginalTestLevelName(testLevel);
                const icon = this.getTestLevelIcon(testLevel);
                
                html += `
                    <div class="tag-selector">
                        <input type="radio" 
                               id="${testLevel}_${feature.id}" 
                               name="test_${feature.id}" 
                               value="${testLevel}" 
                               data-feature-id="${feature.id}"
                               data-time="${testData.time}">
                        <label for="${testLevel}_${feature.id}" class="tag-label ${testLevel}">
                            <i class="fas ${icon}"></i> ${originalName}
                        </label>
                    </div>
                `;
            }
        });
        html += '</div>';
        
        return html;
    }

    // 格式化折叠式测试描述
    formatTestDescriptionForCollapse(description, testLevel, featureId, grayClass = '') {
        if (!description) {
            return '';
        }

        const maxLength = 150; // 截断长度
        
        if (description.length <= maxLength) {
            // 短描述直接显示
            return description;
        } else {
            // 长描述需要截断和展开功能
            const truncatedText = description.substring(0, maxLength);
            const remainingText = description.substring(maxLength);
            const fullDescriptionId = `full_desc_${testLevel}_${featureId}`;
            const previewDescriptionId = `preview_desc_${testLevel}_${featureId}`;
            
            return `
                <span class="description-preview" id="${previewDescriptionId}">
                    ${truncatedText}...
                    <br><a href="javascript:void(0)" class="expand-link" onclick="window.testApp.toggleFullDescription('${testLevel}_${featureId}', true)">
                        <i class="fas fa-chevron-down"></i> Expand details
                    </a>
                </span>
                <span class="description-full" id="${fullDescriptionId}" style="display: none;">
                    ${description}
                    <br><a href="javascript:void(0)" class="collapse-link" onclick="window.testApp.toggleFullDescription('${testLevel}_${featureId}', false)">
                        <i class="fas fa-chevron-up"></i> Collapse
                    </a>
                </span>
            `;
        }
    }

    // 切换test_level描述的显示/隐藏
    toggleTestLevelDescription(descriptionId) {
        const container = document.getElementById(`container_${descriptionId}`);
        const description = document.getElementById(descriptionId);
        const button = document.querySelector(`button[onclick*="${descriptionId}"]`);
        const icon = button?.querySelector('i');
        
        if (!container || !description || !button) return;
        
        const isExpanded = button.getAttribute('data-expanded') === 'true';
        
        if (isExpanded) {
            // 收起
            description.classList.add('collapsed');
            button.setAttribute('data-expanded', 'false');
            button.setAttribute('title', '查看测试描述');
            if (icon) {
                icon.className = 'fas fa-chevron-down';
            }
        } else {
            // 展开
            description.classList.remove('collapsed');
            button.setAttribute('data-expanded', 'true');
            button.setAttribute('title', '隐藏测试描述');
            if (icon) {
                icon.className = 'fas fa-chevron-up';
            }
        }
    }

    // 切换完整描述的展开/收起状态（用于长文本的展开功能）
    toggleFullDescription(descriptionId, expand) {
        const previewElement = document.getElementById(`preview_desc_${descriptionId}`);
        const fullElement = document.getElementById(`full_desc_${descriptionId}`);
        
        if (expand) {
            previewElement.style.display = 'none';
            fullElement.style.display = 'block';
        } else {
            previewElement.style.display = 'block';
            fullElement.style.display = 'none';
        }
    }

    // 切换feature详情的显示/隐藏
    toggleFeatureDetails(featureToggleId) {
        const container = document.getElementById(featureToggleId);
        const button = document.querySelector(`button[onclick*="${featureToggleId}"]`);
        const icon = button?.querySelector('i');
        
        if (!container || !button) return;
        
        const isExpanded = button.getAttribute('data-expanded') === 'true';
        
        if (isExpanded) {
            // 收起
            container.classList.add('collapsed');
            container.classList.remove('expanded');
            button.setAttribute('data-expanded', 'false');
            button.setAttribute('title', '查看测试详情');
            if (icon) {
                icon.className = 'fas fa-chevron-down';
            }
        } else {
            // 展开
            container.classList.remove('collapsed');
            container.classList.add('expanded');
            button.setAttribute('data-expanded', 'true');
            button.setAttribute('title', '隐藏测试详情');
            if (icon) {
                icon.className = 'fas fa-chevron-up';
            }
        }
    }

    // 获取test_level的原始名称
    getOriginalTestLevelName(testLevel) {
        const nameMap = {
            'ci_night': 'CI Night',
            'weekly_regression': 'Weekly Regression', 
            'full_regression': 'Full Regression',
            'regression': 'Regression'
        };
        return nameMap[testLevel] || testLevel.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    // 获取test_level的图标
    getTestLevelIcon(testLevel) {
        const iconMap = {
            'ci_night': 'fa-moon',
            'weekly_regression': 'fa-calendar-week',
            'full_regression': 'fa-sync-alt', 
            'regression': 'fa-sync-alt'
        };
        return iconMap[testLevel] || 'fa-play';
    }

    // 获取功能的可用测试级别
    getAvailableTestLevelsForFeature(parentFeature) {
        const availableTestLevels = new Set();
        
        // 检查父功能本身的test_level
        if (parentFeature.tests) {
            Object.keys(parentFeature.tests).forEach(testLevel => {
                const testData = parentFeature.tests[testLevel];
                if (testData && !testData.isEmpty) {
                    availableTestLevels.add(testLevel);
                }
            });
        }
        
        // 检查所有子功能的test_level
        if (parentFeature.subFeatures) {
            parentFeature.subFeatures.forEach(subFeature => {
                if (subFeature.tests) {
                    Object.keys(subFeature.tests).forEach(testLevel => {
                        const testData = subFeature.tests[testLevel];
                        if (testData && !testData.isEmpty) {
                            availableTestLevels.add(testLevel);
                        }
                    });
                }
            });
        }
        
        return Array.from(availableTestLevels);
    }

    // 新增：获取整个feature group的可用测试类型
    getAvailableTestLevelsForGroup(group) {
        const availableTestLevels = new Set();
        
        // 遍历组内所有features（包括子features）
        group.features.forEach(feature => {
            // 检查主feature的测试类型
            if (feature.tests) {
                Object.keys(feature.tests).forEach(testLevel => {
                    const testData = feature.tests[testLevel];
                    if (testData && !testData.isEmpty) {
                        availableTestLevels.add(testLevel);
                    }
                });
            }
            
            // 检查子features的测试类型
            if (feature.subFeatures) {
                feature.subFeatures.forEach(subFeature => {
                    if (subFeature.tests) {
                        Object.keys(subFeature.tests).forEach(testLevel => {
                            const testData = subFeature.tests[testLevel];
                            if (testData && !testData.isEmpty) {
                                availableTestLevels.add(testLevel);
                            }
                        });
                    }
                });
            }
        });
        
        return Array.from(availableTestLevels);
    }

    // 生成group级别的批量选择选项
    generateGroupBatchSelectOptions(group, availableTestLevels) {
        let html = '';
        
        // 为每个可用的test_level添加选项
        availableTestLevels.forEach(testLevel => {
            const originalName = this.getOriginalTestLevelName(testLevel);
            const icon = this.getTestLevelIcon(testLevel);
            
            html += `
                <div class="batch-option" data-action="select-level" data-group-id="${group.id}" data-test-level="${testLevel}">
                    <i class="fas ${icon}"></i>
                    <span>Select All ${originalName}</span>
                </div>
            `;
        });
        
        // 添加特殊选项
        html += `
            <div class="batch-option-divider"></div>
            <div class="batch-option batch-option-special" data-action="select-all" data-group-id="${group.id}">
                <i class="fas fa-check-double"></i>
                <span>Select All Available</span>
            </div>
            <div class="batch-option batch-option-special" data-action="deselect-all" data-group-id="${group.id}">
                <i class="fas fa-times-circle"></i>
                <span>Deselect All</span>
            </div>
        `;
        
        return html;
    }

    // 生成批量选择选项
    generateBatchSelectOptions(parentFeature, availableTestLevels) {
        let html = '';
        
        // 为每个可用的test_level添加选项
        availableTestLevels.forEach(testLevel => {
            const originalName = this.getOriginalTestLevelName(testLevel);
            const icon = this.getTestLevelIcon(testLevel);
            
            html += `
                <div class="batch-option" data-action="select-level" data-parent-feature-id="${parentFeature.id}" data-test-level="${testLevel}">
                    <i class="fas ${icon}"></i>
                    <span>Select All ${originalName}</span>
                </div>
            `;
        });
        
        // 添加全选所有可用和全部取消选项
        html += `
            <div class="batch-option-divider"></div>
            <div class="batch-option batch-option-special" data-action="select-all" data-parent-feature-id="${parentFeature.id}">
                <i class="fas fa-check-double"></i>
                <span>Select All Available</span>
            </div>
            <div class="batch-option batch-option-special" data-action="deselect-all" data-parent-feature-id="${parentFeature.id}">
                <i class="fas fa-times-circle"></i>
                <span>Deselect All</span>
            </div>
        `;
        
        return html;
    }

    // 处理批量选择操作
    handleBatchSelection(action, parentFeatureId, testLevel = null) {
        const parentFeature = this.findFeature(parentFeatureId);
        if (!parentFeature || !parentFeature.subFeatures) {
            this.showNotification('未找到对应的feature group', 'error');
            return;
        }

        let selectedCount = 0;
        let operationName = '';

        switch (action) {
            case 'select-level':
                // 全选指定的测试级别
                operationName = `全选 ${this.getOriginalTestLevelName(testLevel)}`;
                
                // 为所有子功能选择指定的test_level
                parentFeature.subFeatures.forEach(subFeature => {
                    if (subFeature.tests && subFeature.tests[testLevel] && !subFeature.tests[testLevel].isEmpty) {
                        this.selectTestForFeature(subFeature.id, testLevel);
                        selectedCount++;
                    }
                });
                break;

            case 'select-all':
                // 全选所有可用的测试
                operationName = '全选所有可用';
                
                parentFeature.subFeatures.forEach(subFeature => {
                    // 为每个子功能选择第一个可用的test_level
                    if (subFeature.tests) {
                        for (const [levelName, testData] of Object.entries(subFeature.tests)) {
                            if (testData && !testData.isEmpty) {
                                this.selectTestForFeature(subFeature.id, levelName);
                                selectedCount++;
                                break; // 只选择第一个可用的
                            }
                        }
                    }
                });
                break;

            case 'deselect-all':
                // 取消所有选择
                operationName = '全部取消选择';
                
                parentFeature.subFeatures.forEach(subFeature => {
                    this.deselectTestForFeature(subFeature.id);
                    selectedCount++;
                });
                break;
        }

        // 关闭下拉菜单
        this.closeBatchSelectDropdown(parentFeatureId);

        // 更新显示
        this.updateDisplay();

        // 显示通知
        const featureName = parentFeature.name;
        const message = `${operationName}：${featureName} (${selectedCount}项)`;
        this.showNotification(message, 'success');
    }

    // 处理group级别的批量选择操作
    handleGroupBatchSelection(action, groupId, testLevel = null) {
        // 找到对应的group
        const dataToUse = this.filteredData || this.currentData;
        const group = dataToUse?.featureGroups?.find(g => g.id === groupId);
        
        if (!group) {
            this.showNotification('未找到对应的feature group', 'error');
            return;
        }

        let selectedCount = 0;
        let operationName = '';

        // 获取group内所有features（包括子features）
        const allFeatures = [];
        group.features.forEach(feature => {
            allFeatures.push(feature);
            if (feature.subFeatures) {
                allFeatures.push(...feature.subFeatures);
            }
        });

        switch (action) {
            case 'select-level':
                // 全选指定的测试级别
                operationName = `全选 ${this.getOriginalTestLevelName(testLevel)}`;
                
                allFeatures.forEach(feature => {
                    if (feature.tests && feature.tests[testLevel] && !feature.tests[testLevel].isEmpty) {
                        this.selectTestForFeature(feature.id, testLevel);
                        selectedCount++;
                    }
                });
                break;

            case 'select-all':
                // 全选所有可用的测试
                operationName = '全选所有可用';
                
                allFeatures.forEach(feature => {
                    // 为每个feature选择第一个可用的test_level
                    if (feature.tests) {
                        for (const [levelName, testData] of Object.entries(feature.tests)) {
                            if (testData && !testData.isEmpty) {
                                this.selectTestForFeature(feature.id, levelName);
                                selectedCount++;
                                break; // 只选择第一个可用的
                            }
                        }
                    }
                });
                break;

            case 'deselect-all':
                // 取消所有选择
                operationName = '全部取消选择';
                
                allFeatures.forEach(feature => {
                    this.deselectTestForFeature(feature.id);
                    selectedCount++;
                });
                break;
        }

        // 关闭下拉菜单
        this.closeGroupBatchSelectDropdown(groupId);

        // 更新显示
        this.updateDisplay();

        // 显示通知
        const groupName = group.name;
        const message = `${operationName}：${groupName} (${selectedCount}项)`;
        this.showNotification(message, 'success');
    }

    // 关闭group批量选择下拉菜单
    closeGroupBatchSelectDropdown(groupId) {
        const dropdown = document.getElementById(`group_dropdown_${groupId}`);
        if (dropdown) {
            dropdown.classList.remove('show');
        }
        
        const button = document.querySelector(`button[data-group-id="${groupId}"]`);
        if (button) {
            button.classList.remove('active');
        }
    }

    // 切换group批量选择下拉菜单
    toggleGroupBatchSelectDropdown(groupId) {
        const dropdown = document.getElementById(`group_dropdown_${groupId}`);
        const button = document.querySelector(`button[data-group-id="${groupId}"]`);
        
        if (!dropdown || !button) return;
        
        const isCurrentlyOpen = dropdown.classList.contains('show');
        
        // 先关闭所有下拉菜单
        document.querySelectorAll('.batch-select-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        document.querySelectorAll('.batch-select-btn.active').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 如果当前菜单之前是关闭的，则打开它
        if (!isCurrentlyOpen) {
            dropdown.classList.add('show');
            button.classList.add('active');
        }
        // 如果当前菜单之前是打开的，保持关闭状态（上面的代码已经关闭了）
    }

    // 为指定功能选择测试级别
    selectTestForFeature(featureId, testLevel) {
        // 先清除该功能的现有选择
        this.selectedTests = this.selectedTests.filter(test => test.featureId !== featureId);
        
        // 添加新选择
        const feature = this.findFeature(featureId);
        if (feature && feature.tests && feature.tests[testLevel] && !feature.tests[testLevel].isEmpty) {
            const testData = feature.tests[testLevel];
            this.selectedTests.push({
                featureId, 
                featureName: feature.name, 
                testType: testLevel, 
                time: testData.time || 0,
                groupName: this.findGroupByFeature(featureId)?.name || 'Unknown'
            });
            
            // 更新radio button状态
            const radio = document.querySelector(`input[data-feature-id="${featureId}"][value="${testLevel}"]`);
            if (radio) {
                radio.checked = true;
            }
        }
    }

    // 取消指定功能的测试选择
    deselectTestForFeature(featureId) {
        // 从选择列表中移除
        this.selectedTests = this.selectedTests.filter(test => test.featureId !== featureId);
        
        // 清除radio button状态
        const radioButtons = document.querySelectorAll(`input[name="test_${featureId}"]`);
        radioButtons.forEach(radio => radio.checked = false);
    }

    // 关闭批量选择下拉菜单
    closeBatchSelectDropdown(parentFeatureId) {
        // 关闭指定的下拉菜单
        const dropdown = document.getElementById(`dropdown_${parentFeatureId}`);
        if (dropdown) {
            dropdown.classList.remove('show');
        }
        
        // 移除对应按钮的激活状态
        const button = document.querySelector(`button[data-parent-feature-id="${parentFeatureId}"]`);
        if (button) {
            button.classList.remove('active');
        }
    }

    // 切换批量选择下拉菜单
    toggleBatchSelectDropdown(parentFeatureId) {
        const dropdown = document.getElementById(`dropdown_${parentFeatureId}`);
        const button = document.querySelector(`button[data-parent-feature-id="${parentFeatureId}"]`);
        
        if (!dropdown || !button) return;
        
        const isCurrentlyOpen = dropdown.classList.contains('show');
        
        // 先关闭所有下拉菜单
        document.querySelectorAll('.batch-select-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        document.querySelectorAll('.batch-select-btn.active').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // 如果当前菜单之前是关闭的，则打开它
        if (!isCurrentlyOpen) {
            dropdown.classList.add('show');
            button.classList.add('active');
        }
        // 如果当前菜单之前是打开的，保持关闭状态（上面的代码已经关闭了）
    }

    // 关闭所有批量选择下拉菜单
    closeAllBatchSelectDropdowns() {
        document.querySelectorAll('.batch-select-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
        document.querySelectorAll('.batch-select-btn.active').forEach(btn => {
            btn.classList.remove('active');
        });
    }

    // 截断文本并添加省略号
    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) {
            return text || '';
        }
        return text.substring(0, maxLength) + '...';
    }





    // 搜索功能实现
    handleSearch(searchTerm) {
        this.searchTerm = searchTerm.trim().toLowerCase();
        
        // 显示/隐藏清除按钮
        const clearBtn = document.getElementById('clearSearch');
        if (clearBtn) {
            clearBtn.style.display = this.searchTerm ? 'block' : 'none';
        }
        
        if (!this.searchTerm) {
            // 清空搜索，显示所有数据
            this.filteredData = null;
            this.renderFeatureGroups();
            this.updateSearchInfo(0, 0);
            return;
        }
        
        // 执行搜索过滤
        this.filteredData = this.filterData(this.searchTerm);
        this.renderFeatureGroups();
        
        // 计算搜索结果统计
        const { totalGroups, totalFeatures } = this.calculateSearchResults();
        this.updateSearchInfo(totalGroups, totalFeatures);
        
        // 自动展开所有匹配的组
        this.expandSearchResults();
    }

    filterData(searchTerm) {
        if (!this.currentData || !searchTerm) return null;
        
        const filteredGroups = [];
        
        this.currentData.featureGroups.forEach(group => {
            const groupMatches = this.matchesSearchTerm(group.name, searchTerm) || 
                                 this.matchesSearchTerm(group.description, searchTerm);
            
            const filteredFeatures = [];
            
            group.features.forEach(feature => {
                const featureMatches = groupMatches || 
                                     this.matchesSearchTerm(feature.name, searchTerm) ||
                                     this.matchesSearchTerm(feature.owner, searchTerm) ||
                                     this.matchesSearchTerm(feature.suiteName, searchTerm) ||
                                     this.matchesSearchTerm(feature.remark, searchTerm) ||
                                     this.searchInTestDescriptions(feature, searchTerm);
                
                // 检查子功能
                let filteredSubFeatures = [];
                if (feature.subFeatures) {
                    feature.subFeatures.forEach(subFeature => {
                        const subFeatureMatches = featureMatches ||
                                                this.matchesSearchTerm(subFeature.name, searchTerm) ||
                                                this.matchesSearchTerm(subFeature.owner, searchTerm) ||
                                                this.matchesSearchTerm(subFeature.suiteName, searchTerm) ||
                                                this.matchesSearchTerm(subFeature.remark, searchTerm) ||
                                                this.searchInTestDescriptions(subFeature, searchTerm);
                        
                        if (subFeatureMatches) {
                            filteredSubFeatures.push({
                                ...subFeature,
                                _highlighted: true
                            });
                        }
                    });
                }
                
                if (featureMatches || filteredSubFeatures.length > 0) {
                    filteredFeatures.push({
                        ...feature,
                        subFeatures: filteredSubFeatures.length > 0 ? filteredSubFeatures : feature.subFeatures,
                        _highlighted: featureMatches
                    });
                }
            });
            
            if (groupMatches || filteredFeatures.length > 0) {
                filteredGroups.push({
                    ...group,
                    features: filteredFeatures,
                    _highlighted: groupMatches
                });
            }
        });
        
        return {
            ...this.currentData,
            featureGroups: filteredGroups,
            testLevels: this.currentData.testLevels || []
        };
    }

    matchesSearchTerm(text, searchTerm) {
        if (!text || !searchTerm) return false;
        return text.toLowerCase().includes(searchTerm.toLowerCase());
    }

    highlightSearchTerm(text) {
        if (!text || !this.searchTerm) return text;
        
        const regex = new RegExp(`(${this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    searchInTestDescriptions(feature, searchTerm) {
        if (!feature.tests) return false;
        
        for (const testLevel in feature.tests) {
            const testData = feature.tests[testLevel];
            if (testData.description && this.matchesSearchTerm(testData.description, searchTerm)) {
                return true;
            }
        }
        return false;
    }

    calculateSearchResults() {
        if (!this.filteredData) return { totalGroups: 0, totalFeatures: 0 };
        
        const totalGroups = this.filteredData.featureGroups.length;
        let totalFeatures = 0;
        
        this.filteredData.featureGroups.forEach(group => {
            totalFeatures += group.features.length;
            group.features.forEach(feature => {
                if (feature.subFeatures) {
                    totalFeatures += feature.subFeatures.length;
                }
            });
        });
        
        return { totalGroups, totalFeatures };
    }

    updateSearchInfo(totalGroups, totalFeatures) {
        const searchInfo = document.getElementById('searchInfo');
        const searchResults = document.getElementById('searchResults');
        
        if (!searchInfo || !searchResults) return;
        
        if (this.searchTerm && (totalGroups > 0 || totalFeatures > 0)) {
            searchResults.textContent = `找到 ${totalGroups} 个feature group，${totalFeatures} 个feature tag`;
            searchInfo.style.display = 'block';
        } else if (this.searchTerm) {
            searchResults.textContent = '未找到匹配的feature tag';
            searchInfo.style.display = 'block';
        } else {
            searchInfo.style.display = 'none';
        }
    }

    expandSearchResults() {
        if (!this.filteredData) return;
        
        // 自动展开所有匹配的功能组和子功能组
        this.filteredData.featureGroups.forEach(group => {
            this.expandedGroups.add(group.id);
            
            group.features.forEach(feature => {
                if (feature.subFeatures && feature.subFeatures.length > 0) {
                    this.expandedSubGroups.add(feature.id);
                }
            });
        });
    }

    clearSearch() {
        const searchInput = document.getElementById('featureSearch');
        const clearBtn = document.getElementById('clearSearch');
        
        if (searchInput) {
            searchInput.value = '';
        }
        
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        
        this.searchTerm = '';
        this.filteredData = null;
        this.renderFeatureGroups();
        this.updateSearchInfo(0, 0);
        
        this.showNotification('已清除搜索条件', 'info');
    }

    // 配置搜索功能
    handleConfigSearch(searchTerm) {
        this.configSearchTerm = searchTerm.toLowerCase();
        this.filterConfigs();
        this.updateConfigHistoryDisplay();
        this.updateConfigSearchInfo();
    }

    filterConfigs() {
        if (!this.configSearchTerm) {
            this.filteredConfigs = this.savedConfigs;
            return;
        }

        this.filteredConfigs = this.savedConfigs.filter(config => {
            // 搜索配置名称
            const nameMatch = config.name.toLowerCase().includes(this.configSearchTerm);
            
            // 搜索配置描述
            const descMatch = config.description && config.description.toLowerCase().includes(this.configSearchTerm);
            
            // 搜索配置中的功能标签
            const tagMatch = config.tests.some(test => 
                test.featureName.toLowerCase().includes(this.configSearchTerm) ||
                test.testType.toLowerCase().includes(this.configSearchTerm) ||
                test.groupName.toLowerCase().includes(this.configSearchTerm)
            );
            
            return nameMatch || descMatch || tagMatch;
        });
    }

    updateConfigSearchInfo() {
        const searchInfo = document.getElementById('configSearchInfo');
        const searchResults = document.getElementById('configSearchResults');
        
        if (!searchInfo || !searchResults) return;
        
        if (this.configSearchTerm) {
            const totalConfigs = this.savedConfigs.length;
            const filteredCount = this.filteredConfigs.length;
            
            searchInfo.style.display = 'block';
            searchResults.innerHTML = `找到 ${filteredCount} / ${totalConfigs} 个配置`;
            
            if (filteredCount === 0) {
                searchResults.innerHTML += ' - 尝试其他搜索词';
            }
        } else {
            searchInfo.style.display = 'none';
        }
    }

    clearConfigSearch() {
        this.configSearchTerm = '';
        this.filteredConfigs = this.savedConfigs;
        
        // 清空搜索框
        const searchInput = document.getElementById('configSearch');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // 隐藏清空按钮
        const clearBtn = document.getElementById('clearConfigSearch');
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        
        // 隐藏搜索信息
        const searchInfo = document.getElementById('configSearchInfo');
        if (searchInfo) {
            searchInfo.style.display = 'none';
        }
        
        // 重新显示所有配置
        this.updateConfigHistoryDisplay();
        this.showNotification('已清空配置搜索', 'info');
    }

    // 配置模态框搜索功能
    handleConfigModalSearch(searchTerm) {
        this.configModalSearchTerm = searchTerm.toLowerCase();
        this.filterConfigsForModal();
        this.updateConfigManagementList();
        this.updateConfigModalSearchInfo();
    }

    filterConfigsForModal() {
        if (!this.configModalSearchTerm) {
            this.filteredConfigsForModal = this.savedConfigs;
            return;
        }

        this.filteredConfigsForModal = this.savedConfigs.filter(config => {
            // 搜索配置名称
            const nameMatch = config.name.toLowerCase().includes(this.configModalSearchTerm);
            
            // 搜索配置描述
            const descMatch = config.description && config.description.toLowerCase().includes(this.configModalSearchTerm);
            
            // 搜索配置中的功能标签
            const tagMatch = config.tests.some(test => 
                test.featureName.toLowerCase().includes(this.configModalSearchTerm) ||
                test.testType.toLowerCase().includes(this.configModalSearchTerm) ||
                test.groupName.toLowerCase().includes(this.configModalSearchTerm)
            );
            
            return nameMatch || descMatch || tagMatch;
        });
    }

    updateConfigModalSearchInfo() {
        const searchInfo = document.getElementById('configModalSearchInfo');
        const searchResults = document.getElementById('configModalSearchResults');
        
        if (!searchInfo || !searchResults) return;
        
        if (this.configModalSearchTerm) {
            const totalConfigs = this.savedConfigs.length;
            const filteredCount = this.filteredConfigsForModal.length;
            
            searchInfo.style.display = 'block';
            searchResults.innerHTML = `找到 ${filteredCount} / ${totalConfigs} 个配置`;
            
            if (filteredCount === 0) {
                searchResults.innerHTML += ' - 尝试其他搜索词';
            }
        } else {
            searchInfo.style.display = 'none';
        }
    }

    clearConfigModalSearch() {
        this.configModalSearchTerm = '';
        this.filteredConfigsForModal = this.savedConfigs;
        
        // 清空搜索框
        const searchInput = document.getElementById('configModalSearch');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // 隐藏清空按钮
        const clearBtn = document.getElementById('clearConfigModalSearch');
        if (clearBtn) {
            clearBtn.style.display = 'none';
        }
        
        // 隐藏搜索信息
        const searchInfo = document.getElementById('configModalSearchInfo');
        if (searchInfo) {
            searchInfo.style.display = 'none';
        }
        
        // 重新显示所有配置
        this.updateConfigManagementList();
        this.showNotification('已清空配置搜索', 'info');
    }

    bindEventListeners() {
        // 主要点击事件处理器
        document.addEventListener('click', (e) => {
            // 批量选择按钮点击 - 优先处理，防止冒泡
            if (e.target.closest('.batch-select-btn')) {
                e.stopPropagation();
                e.preventDefault();
                const button = e.target.closest('.batch-select-btn');
                
                // 区分是group级别还是feature级别的批量选择
                if (button.classList.contains('group-batch-select')) {
                    // Group级别的批量选择
                    const groupId = button.dataset.groupId;
                    this.toggleGroupBatchSelectDropdown(groupId);
                } else {
                    // Feature级别的批量选择
                    const parentFeatureId = button.dataset.parentFeatureId;
                    this.toggleBatchSelectDropdown(parentFeatureId);
                }
                return; // 早期返回，防止执行后续逻辑
            }
            
            // 批量选择选项点击
            if (e.target.closest('.batch-option')) {
                e.stopPropagation();
                e.preventDefault();
                const option = e.target.closest('.batch-option');
                const action = option.dataset.action;
                const testLevel = option.dataset.testLevel;
                
                // 区分是group级别还是feature级别的批量选择
                if (option.dataset.groupId) {
                    // Group级别的批量选择
                    const groupId = option.dataset.groupId;
                    this.handleGroupBatchSelection(action, groupId, testLevel);
                } else {
                    // Feature级别的批量选择
                    const parentFeatureId = option.dataset.parentFeatureId;
                    this.handleBatchSelection(action, parentFeatureId, testLevel);
                }
                return; // 早期返回，防止执行后续逻辑
            }
            
            // 组折叠/展开 - 确保不与批量选择按钮冲突
            if (e.target.closest('.group-header')) {
                // 检查点击的是否是批量选择相关的元素
                if (e.target.closest('.batch-select-container') || 
                    e.target.closest('.batch-select-btn') || 
                    e.target.closest('.batch-select-dropdown')) {
                    // 如果点击的是批量选择相关元素，不触发group toggle
                    return;
                }
                
                const groupId = e.target.closest('.group-header').dataset.groupId;
                this.toggleGroup(groupId);
                return; // 早期返回，防止执行后续逻辑
            }
            
            // 标签选择 - 使用click事件支持取消功能
            if (e.target.type === 'radio' && e.target.name.startsWith('test_')) {
                this.handleTestSelection(e.target);
                return; // 早期返回，防止执行后续逻辑
            }
            
            // 点击其他地方关闭下拉菜单
            this.closeAllBatchSelectDropdowns();
        });

        // 批量选择容器鼠标离开事件 - 使用事件委托
        document.addEventListener('mouseleave', (e) => {
            // 检查是否离开了批量选择容器
            if (e.target.classList && e.target.classList.contains('batch-select-container')) {
                // 使用setTimeout来延迟关闭，避免鼠标快速移动时误关闭
                setTimeout(() => {
                    // 检查鼠标是否真的离开了整个容器区域
                    if (!e.target.matches(':hover')) {
                        // 检查容器内是否有激活的下拉菜单
                        const activeDropdown = e.target.querySelector('.batch-select-dropdown.show');
                        if (activeDropdown) {
                            this.closeAllBatchSelectDropdowns();
                        }
                    }
                }, 200); // 200ms延迟，给用户足够时间移动到下拉菜单
            }
        }, true); // 使用capture阶段确保能捕获到事件

        // 按钮事件
        document.getElementById('generateBtn').addEventListener('click', () => this.generateCommand());
        document.getElementById('copyBtn').addEventListener('click', () => this.copyCommand());
        document.getElementById('clearAllBtn').addEventListener('click', () => this.clearAllSelections());
        document.getElementById('expandAll').addEventListener('click', () => this.toggleAllGroups());
        
        // 配置历史按钮
        document.getElementById('saveConfigBtn').addEventListener('click', () => this.showSaveConfigModal());
        document.getElementById('manageConfigBtn').addEventListener('click', () => this.showManageConfigModal());
        document.getElementById('parseExcel').addEventListener('click', () => this.parseExcelFile());
        document.getElementById('showCurrentData').addEventListener('click', () => this.showCurrentDataDetails());
        document.getElementById('clearCurrentData')?.addEventListener('click', () => this.confirmClearCurrentData());
        document.getElementById('resetToDefault')?.addEventListener('click', () => this.resetToDefaultData());
        document.getElementById('settingsToggle').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSettings();
        });

        // 全局点击事件处理器 - 点击设置面板外部时关闭面板
        document.addEventListener('click', (e) => {
            const settingsPanel = document.getElementById('settingsPanel');
            if (settingsPanel && settingsPanel.classList.contains('active')) {
                // 如果点击的不是设置面板或其子元素，则关闭面板
                if (!settingsPanel.contains(e.target)) {
                    settingsPanel.classList.remove('active');
                    this.removeSettingsMouseLeaveHandler();
                }
            }
        });

        // 防止设置面板内部点击关闭面板
        const settingsPanel = document.getElementById('settingsPanel');
        if (settingsPanel) {
            settingsPanel.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
        
        // 防止设置容器内部点击关闭面板
        const settingsContainer = document.querySelector('.settings-container');
        if (settingsContainer) {
            settingsContainer.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // 测试按钮
        document.getElementById('testRealData')?.addEventListener('click', () => this.testWithRealData());
        document.getElementById('testRender')?.addEventListener('click', () => this.testRenderFunction());
        document.getElementById('testExcelParsing')?.addEventListener('click', () => this.testExcelParsing());
        document.getElementById('testDebugBtn')?.addEventListener('click', () => this.testDebugFunctions());
        document.getElementById('testMultiLevel')?.addEventListener('click', () => this.testMultiLevelFeatures());
        document.getElementById('testSubFeatures')?.addEventListener('click', () => this.testSubFeatureGroups());

        // 搜索功能
        const searchInput = document.getElementById('featureSearch');
        const clearSearchBtn = document.getElementById('clearSearch');
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearSearch();
                }
            });
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => this.clearSearch());
        }

        // 配置搜索功能
        const configSearchInput = document.getElementById('configSearch');
        const clearConfigSearchBtn = document.getElementById('clearConfigSearch');
        
        if (configSearchInput) {
            configSearchInput.addEventListener('input', (e) => this.handleConfigSearch(e.target.value));
            configSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearConfigSearch();
                }
            });
        }
        
        if (clearConfigSearchBtn) {
            clearConfigSearchBtn.addEventListener('click', () => this.clearConfigSearch());
        }

        // 配置模态框搜索功能
        const configModalSearchInput = document.getElementById('configModalSearch');
        const clearConfigModalSearchBtn = document.getElementById('clearConfigModalSearch');
        
        if (configModalSearchInput) {
            configModalSearchInput.addEventListener('input', (e) => this.handleConfigModalSearch(e.target.value));
            configModalSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearConfigModalSearch();
                }
            });
        }
        
        if (clearConfigModalSearchBtn) {
            clearConfigModalSearchBtn.addEventListener('click', () => this.clearConfigModalSearch());
        }


    }

    toggleGroup(groupId) {
        const isCurrentlyExpanded = this.expandedGroups.has(groupId);
        
        if (isCurrentlyExpanded) {
            // 如果当前group已展开，则关闭它
            this.expandedGroups.delete(groupId);
        } else {
            // 如果处于"展开全部"模式，点击任何group会恢复手风琴模式
            if (this.isExpandAllMode) {
                this.expandedGroups.clear(); // 关闭所有group
                this.expandedGroups.add(groupId); // 展开当前group
                this.isExpandAllMode = false; // 退出"展开全部"模式
                this.showNotification('已恢复手风琴模式', 'info');
            } else {
                // 正常的手风琴模式：先关闭所有其他group，然后展开当前group
                this.expandedGroups.clear(); // 关闭所有group
                this.expandedGroups.add(groupId); // 展开当前group
            }
        }
        
        this.renderFeatureGroups();
        this.updateExpandAllButton();
    }

    toggleSubGroup(featureId) {
        if (this.expandedSubGroups.has(featureId)) {
            this.expandedSubGroups.delete(featureId);
        } else {
            this.expandedSubGroups.add(featureId);
        }
        
        // 更新按钮状态
        const button = document.querySelector(`button[onclick*="toggleSubGroup('${featureId}')"]`);
        const icon = button?.querySelector('i');
        const subFeaturesList = document.querySelector(`.sub-features-list[data-feature-id="${featureId}"]`);
        
        const isExpanded = this.expandedSubGroups.has(featureId);
        
        if (button) {
            button.setAttribute('data-expanded', isExpanded);
            button.setAttribute('title', isExpanded ? '收起子功能' : '展开子功能');
        }
        
        if (icon) {
            if (isExpanded) {
                icon.style.transform = 'rotate(180deg)';
            } else {
                icon.style.transform = 'rotate(0deg)';
            }
        }
        
        if (subFeaturesList) {
            if (isExpanded) {
                subFeaturesList.classList.add('expanded');
                subFeaturesList.classList.remove('collapsed');
            } else {
                subFeaturesList.classList.remove('expanded');
                subFeaturesList.classList.add('collapsed');
            }
        }
        
        this.renderFeatureGroups();
    }

    toggleAllGroups() {
        const dataToUse = this.filteredData || this.currentData;
        if (!dataToUse?.featureGroups) return;
        
        const allGroupIds = dataToUse.featureGroups.map(group => group.id);
        const hasAnyExpanded = allGroupIds.some(id => this.expandedGroups.has(id));

        if (hasAnyExpanded) {
            // 折叠全部（只要有任何一个展开就执行折叠）
            this.expandedGroups.clear();
            this.expandedSubGroups.clear();
            this.isExpandAllMode = false; // 退出"展开全部"模式
            this.showNotification('已折叠所有feature group', 'info');
        } else {
            // 全部展开（暂时打破手风琴效果，允许同时展开多个group）
            allGroupIds.forEach(id => this.expandedGroups.add(id));
            this.isExpandAllMode = true; // 进入"展开全部"模式
            this.showNotification('已展开所有feature group（点击单个group将恢复手风琴模式）', 'success');
        }
        this.renderFeatureGroups();
        this.updateExpandAllButton();
    }

    updateExpandAllButton() {
        const expandBtn = document.getElementById('expandAll');
        const dataToUse = this.filteredData || this.currentData;
        if (!dataToUse?.featureGroups) return;
        
        const allGroupIds = dataToUse.featureGroups.map(group => group.id);
        const hasAnyExpanded = allGroupIds.some(id => this.expandedGroups.has(id));
        const isAllExpanded = allGroupIds.every(id => this.expandedGroups.has(id));
        
        if (hasAnyExpanded) {
            expandBtn.innerHTML = '<i class="fas fa-compress-alt"></i> Collapse All';
            expandBtn.classList.add('has-expanded');
        } else {
            expandBtn.innerHTML = '<i class="fas fa-expand-alt"></i> Expand All';
            expandBtn.classList.remove('has-expanded');
        }
        
        // 如果全部展开，添加特殊样式
        if (isAllExpanded) {
            expandBtn.classList.add('all-expanded');
        } else {
            expandBtn.classList.remove('all-expanded');
        }
    }

    handleTestSelection(radioInput) {
        const featureId = radioInput.dataset.featureId;
        const testType = radioInput.value;
        const time = parseInt(radioInput.dataset.time) || 0;

        // 检查是否已经选择了这个功能的这个测试类型
        const existingTest = this.selectedTests.find(test => 
            test.featureId === featureId && test.testType === testType
        );

        // 移除该功能的所有选择
        this.selectedTests = this.selectedTests.filter(test => test.featureId !== featureId);

        // 如果之前没有选择这个测试类型，则添加新选择；如果已选择，则取消（不添加回去）
        if (!existingTest) {
            const feature = this.findFeature(featureId);
            if (feature) {
                this.selectedTests.push({
                    featureId, 
                    featureName: feature.name, 
                    testType, 
                    time,
                    groupName: this.findGroupByFeature(featureId)?.name || 'Unknown'
                });
                // 保持radio button选中状态
                radioInput.checked = true;
            }
        } else {
            // 取消选择 - 清除所有同名radio button的选中状态
            const radioButtons = document.querySelectorAll(`input[name="test_${featureId}"]`);
            radioButtons.forEach(radio => radio.checked = false);
            
            this.showNotification(`已取消选择: ${existingTest.featureName} - ${this.getTestTypeDisplayName(existingTest.testType)}`, 'info');
        }

        this.updateDisplay();
    }

    findFeature(featureId) {
        for (const group of this.currentData.featureGroups) {
            for (const feature of group.features) {
                if (feature.id === featureId) return feature;
                if (feature.subFeatures) {
                    for (const subFeature of feature.subFeatures) {
                        if (subFeature.id === featureId) return subFeature;
                    }
                }
            }
        }
        return null;
    }

    findGroupByFeature(featureId) {
        for (const group of this.currentData.featureGroups) {
            for (const feature of group.features) {
                if (feature.id === featureId) return group;
                if (feature.subFeatures?.some(sf => sf.id === featureId)) return group;
            }
        }
        return null;
    }

    getTestTypeDisplayName(testType) {
        const displayNames = {
            'ci_night': 'CI Night',
            'regression': 'Regression', 
            'weekly_regression': 'Weekly Regression',
            'full_regression': 'Full Regression'
        };
        return displayNames[testType] || testType;
    }

    updateDisplay() {
        this.updateTotalTime();
        this.updateSelectedList();
    }

    updateTotalTime() {
        const totalMinutes = this.selectedTests.reduce((sum, test) => sum + test.time, 0);
        document.getElementById('totalTime').textContent = formatTime(totalMinutes);
    }

    updateSelectedList() {
        const listContainer = document.getElementById('selectedList');
        const statsContainer = document.getElementById('selectedStats');
        
        // 更新统计信息
        this.updateSelectedStats();
        
        if (this.selectedTests.length === 0) {
            listContainer.innerHTML = `
                <div class="placeholder">
                    <div class="placeholder-text">No selection</div>
                    <div class="placeholder-hint">Select feature tags from the left to display here</div>
                </div>
            `;
            return;
        }

        const groupedTests = this.selectedTests.reduce((groups, test) => {
            if (!groups[test.groupName]) groups[test.groupName] = [];
            groups[test.groupName].push(test);
            return groups;
        }, {});

        let html = '';
        Object.keys(groupedTests).forEach(groupName => {
            html += `<div class="selected-group">
                <div class="selected-group-header">
                    <i class="fas fa-folder-open"></i>
                    ${groupName}
                </div>
                <div class="selected-table">`;
            
            groupedTests[groupName].forEach(test => {
                // 使用正确的测试类型显示名称
                const testTypeDisplay = this.getTestTypeDisplayName(test.testType);
                const timeDisplay = formatTime(test.time);
                
                html += `
                    <div class="selected-row">
                        <div class="selected-feature">${test.featureName}</div>
                        <div class="selected-test-type">${testTypeDisplay}</div>
                        <div class="selected-time">${timeDisplay}</div>
                        <button class="remove-btn" onclick="app.removeSelectedTest('${test.featureName}', '${test.testType}')" title="移除此项">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            });
            
            html += `</div></div>`;
        });
        listContainer.innerHTML = html;
    }

    updateSelectedStats() {
        const statsContainer = document.getElementById('selectedStats');
        const count = this.selectedTests.length;
        const totalTime = this.selectedTests.reduce((sum, test) => sum + test.time, 0);
        
        // 当数量为0时，不显示统计信息
        if (count === 0) {
            statsContainer.innerHTML = '';
            return;
        }
        
        statsContainer.innerHTML = `
            <span class="stats-item">
                <i class="fas fa-tag"></i> ${count} selected
            </span>
            <span class="stats-item">
                <i class="fas fa-clock"></i> ${formatTime(totalTime)}
            </span>
        `;
    }

    removeSelectedTest(featureName, testType) {
        // 从选中测试数组中移除
        this.selectedTests = this.selectedTests.filter(test => 
            !(test.featureName === featureName && test.testType === testType)
        );
        
        // 取消对应的radio button选中状态
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            if (radio.name === `test_${featureName}` && radio.value === testType) {
                radio.checked = false;
            }
        });
        
        // 更新显示
        this.updateDisplay();
        
        // 显示通知
        this.showNotification(`已移除 ${featureName} - ${this.getTestTypeDisplayName(testType)}`, 'info');
    }

    generateCommand() {
        if (this.selectedTests.length === 0) {
            this.showNotification('请先选择测试标签', 'warning');
            return;
        }
        
        // 生成新格式的命令：- --include test_levelANDfeature_tag
        const commands = this.selectedTests.map(test => {
            return `- --include ${test.testType}AND${test.featureName}`;
        });
        
        // 每个命令换行显示
        const commandText = commands.join('\n');
        
        document.getElementById('commandOutput').innerHTML = `<pre><code>${commandText}</code></pre>`;
        document.getElementById('copyBtn').style.display = 'block';
    }

    async copyCommand() {
        const commandText = document.querySelector('#commandOutput code')?.textContent;
        if (!commandText) {
            this.showNotification('没有可复制的命令', 'warning');
            return;
        }
        
        // 首先记录环境信息以便调试
        this.getClipboardInfo();
        
        // 尝试现代 Clipboard API（适用于安全上下文）
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(commandText);
                this.showNotification('✅ Command copied to clipboard successfully!', 'success');
                return;
            } catch (error) {
                console.warn('📋 Clipboard API failed, falling back to execCommand:', error);
                // 继续尝试fallback方案
            }
        }
        
        // Fallback方案：使用传统的 execCommand（兼容所有环境）
        try {
            const success = this.fallbackCopyToClipboard(commandText);
            if (success) {
                this.showNotification('✅ Command copied to clipboard (fallback method)', 'success');
            } else {
                console.warn('📋 Both clipboard methods failed, showing manual copy modal');
                this.showManualCopyModal(commandText);
            }
        } catch (error) {
            console.error('📋 All copy methods failed:', error);
            this.showManualCopyModal(commandText);
        }
    }

    // Fallback复制方案 - 兼容所有浏览器和环境
    fallbackCopyToClipboard(text) {
        // 创建临时文本区域
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // 设置样式使其不可见
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        textArea.style.opacity = '0';
        textArea.style.zIndex = '-1';
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            // 尝试执行复制命令
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (err) {
            document.body.removeChild(textArea);
            console.error('execCommand copy failed:', err);
            return false;
        }
    }

    // 显示手动复制模态框
    showManualCopyModal(commandText) {
        const modal = this.createManualCopyModal(commandText);
        document.body.appendChild(modal);
        
        // 自动选择文本
        const textarea = modal.querySelector('.manual-copy-textarea');
        textarea.focus();
        textarea.select();
        
        // 添加关闭事件
        const closeBtn = modal.querySelector('.close-manual-copy');
        const backdrop = modal.querySelector('.manual-copy-backdrop');
        
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        closeBtn.addEventListener('click', closeModal);
        backdrop.addEventListener('click', closeModal);
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
        
        this.showNotification('🔒 Manual copy required due to browser security restrictions', 'warning');
    }

    // 检测复制能力和环境信息（调试用）
    getClipboardInfo() {
        const info = {
            hasClipboardAPI: !!navigator.clipboard,
            isSecureContext: window.isSecureContext,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            userAgent: navigator.userAgent.substring(0, 100) + '...',
            execCommandSupported: document.queryCommandSupported && document.queryCommandSupported('copy')
        };
        
        console.log('📋 Clipboard环境信息:', info);
        return info;
    }

    // 测试复制功能（供开发者调试使用）
    async testCopyFunction() {
        console.log('🧪 Testing copy function...');
        const testText = 'Test copy function - ' + new Date().toISOString();
        
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(testText);
                console.log('✅ Modern Clipboard API works!');
                return 'modern';
            } else {
                const success = this.fallbackCopyToClipboard(testText);
                if (success) {
                    console.log('✅ Fallback execCommand works!');
                    return 'fallback';
                } else {
                    console.log('❌ Both methods failed');
                    return 'failed';
                }
            }
        } catch (error) {
            console.error('❌ Copy test error:', error);
            return 'error';
        }
    }

    // 创建手动复制模态框
    createManualCopyModal(commandText) {
        const clipboardInfo = this.getClipboardInfo();
        const isHttps = clipboardInfo.protocol === 'https:';
        const isLocalhost = clipboardInfo.hostname === 'localhost' || clipboardInfo.hostname === '127.0.0.1';
        const isFileProtocol = clipboardInfo.protocol === 'file:';
        
        let reasonText = '';
        if (!isHttps && !isLocalhost && !isFileProtocol) {
            reasonText = `当前页面使用 HTTP 协议访问远程服务器，现代浏览器出于安全考虑限制了剪贴板操作。`;
        } else if (!clipboardInfo.hasClipboardAPI) {
            reasonText = `浏览器不支持现代剪贴板 API。`;
        } else {
            reasonText = `剪贴板操作被浏览器阻止。`;
        }
        
        const modalHtml = `
            <div class="manual-copy-modal">
                <div class="manual-copy-backdrop"></div>
                <div class="manual-copy-content">
                    <div class="manual-copy-header">
                        <h3><i class="fas fa-copy"></i> Manual Copy Required</h3>
                        <button class="close-manual-copy" type="button">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="manual-copy-body">
                        <p><i class="fas fa-shield-alt"></i> ${reasonText}</p>
                        <textarea class="manual-copy-textarea" readonly>${commandText}</textarea>
                        <div class="manual-copy-tips">
                            <strong>Copy Methods:</strong>
                            <ul>
                                <li><kbd>Ctrl+A</kbd> Select All → <kbd>Ctrl+C</kbd> Copy (Windows/Linux)</li>
                                <li><kbd>Cmd+A</kbd> Select All → <kbd>Cmd+C</kbd> Copy (macOS)</li>
                                <li>Right-click and select "Copy" after selecting text</li>
                            </ul>
                                                         <div class="environment-info">
                                 <strong>Environment Info:</strong>
                                 <ul>
                                     <li>Protocol: <code>${clipboardInfo.protocol}</code></li>
                                     <li>Secure Context: <code>${clipboardInfo.isSecureContext ? 'Yes' : 'No'}</code></li>
                                     <li>Clipboard API: <code>${clipboardInfo.hasClipboardAPI ? 'Available' : 'Not Available'}</code></li>
                                 </ul>
                                 ${!isHttps && !isLocalhost && !isFileProtocol ? `
                                 <div class="solution-tips">
                                     <strong>💡 Solution:</strong>
                                     <p>To enable automatic copying, access this page via HTTPS or localhost:</p>
                                     <ul>
                                         <li>Ask your admin to configure HTTPS for this server</li>
                                         <li>Or access via <code>https://your-server/path</code></li>
                                         <li>Or use <code>localhost</code> if running locally</li>
                                     </ul>
                                 </div>
                                 ` : ''}
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        return div.firstElementChild;
    }

    clearAllSelections() {
        // 清空选择的测试数组
        this.selectedTests = [];
        
        // 清空活跃配置状态
        this.clearActiveConfig();
        
        // 清空所有radio button的选中状态
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => radio.checked = false);
        
        // 清空命令输出
        document.getElementById('commandOutput').innerHTML = '<p class="placeholder">Please select test tags and click generate command</p>';
        document.getElementById('copyBtn').style.display = 'none';
        
        // 重置统计信息
        const statsContainer = document.getElementById('selectedStats');
        if (statsContainer) {
            statsContainer.innerHTML = '';
        }
        
        // 更新显示
        this.updateDisplay();
        
        // 显示通知
        this.showNotification('已清空所有选择', 'info');
    }

    toggleSettings() {
        const settingsPanel = document.getElementById('settingsPanel');
        const isActive = settingsPanel.classList.contains('active');
        
        if (isActive) {
            // 关闭设置面板
            settingsPanel.classList.remove('active');
            this.removeSettingsMouseLeaveHandler();
        } else {
            // 打开设置面板
            settingsPanel.classList.add('active');
            this.addSettingsMouseLeaveHandler();
        }
    }

    addSettingsMouseLeaveHandler() {
        const settingsPanel = document.getElementById('settingsPanel');
        
        // 移除可能存在的旧事件监听器
        this.removeSettingsMouseLeaveHandler();
        
        // 创建新的事件处理函数
        this.settingsMouseLeaveHandler = (event) => {
            // 检查鼠标是否真的离开了设置面板区域
            const rect = settingsPanel.getBoundingClientRect();
            const mouseX = event.clientX;
            const mouseY = event.clientY;
            
            // 如果鼠标在面板外部，则关闭面板
            if (mouseX < rect.left || mouseX > rect.right || 
                mouseY < rect.top || mouseY > rect.bottom) {
                settingsPanel.classList.remove('active');
                this.removeSettingsMouseLeaveHandler();
            }
        };
        
        // 添加事件监听器
        settingsPanel.addEventListener('mouseleave', this.settingsMouseLeaveHandler);
    }

    removeSettingsMouseLeaveHandler() {
        const settingsPanel = document.getElementById('settingsPanel');
        if (this.settingsMouseLeaveHandler) {
            settingsPanel.removeEventListener('mouseleave', this.settingsMouseLeaveHandler);
            this.settingsMouseLeaveHandler = null;
        }
    }

    showNotification(message, type = 'info') {
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) existingNotification.remove();

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        let iconClass;
        switch (type) {
            case 'success': iconClass = 'fa-check-circle'; break;
            case 'warning': iconClass = 'fa-exclamation-triangle'; break;
            case 'error': iconClass = 'fa-times-circle'; break;
            default: iconClass = 'fa-info-circle';
        }

        notification.innerHTML = `
            <i class="fas ${iconClass}"></i>
            <span>${message}</span>
            <button class="close-notification">&times;</button>
        `;

        document.body.appendChild(notification);
        notification.querySelector('.close-notification').addEventListener('click', () => notification.remove());
        setTimeout(() => { if (notification.parentNode) notification.remove(); }, 5000);
    }

    // Excel解析功能 - 从debug-excel.html移植的完整逻辑
    async parseExcelFile() {
        const fileInput = document.getElementById('excelFile');
        const sheetNameInput = document.getElementById('sheetName');
        const previewDiv = document.getElementById('excelPreview');
        const previewContent = document.getElementById('excelPreviewContent');

        if (!fileInput.files || fileInput.files.length === 0) {
            console.log('❌ 解析错误: 请先选择Excel文件');
            this.showNotification('请先选择Excel文件', 'error');
            return;
        }

        const file = fileInput.files[0];
        const sheetName = sheetNameInput.value.trim() || 'Sheet1';
        
        console.log(`🚀 [开始解析] 解析文件: ${file.name}, 工作表: ${sheetName}`);
        this.showNotification('正在解析Excel文件...', 'info');

        try {
            // 读取文件
            console.log('📖 [文件读取] 正在读取文件内容...');
            const arrayBuffer = await file.arrayBuffer();
            
            // 解析Excel
            console.log('📋 [Excel解析] 正在解析Excel工作簿...');
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            console.log(`📑 [工作表检查] 可用工作表: ${workbook.SheetNames.join(', ')}`);
            
            if (!workbook.SheetNames.includes(sheetName)) {
                throw new Error(`工作表 "${sheetName}" 不存在`);
            }

            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            console.log(`📈 [数据提取] ✅ 提取到 ${jsonData.length} 行数据`);
            
            // 使用增强的解析逻辑
            const parsedData = this.convertExcelToFeatureData(jsonData);
            
            console.log(`🎉 [解析完成] ✅ 成功解析 ${parsedData.featureGroups.length} 个feature group`);
            
            // 更新界面
            previewDiv.style.display = 'block';
            previewContent.innerHTML = this.generateDetailedExcelPreview(parsedData);

            this.currentData = parsedData;
            
            // 保存解析的数据到服务器
            await this.saveCurrentData();
            
            this.renderFeatureGroups();
            this.updateDisplay();
            await this.updateDataStatusDisplay(); // 更新数据状态显示
            
            // 计算统计信息用于通知
            const totalFeatures = parsedData.featureGroups.reduce((sum, group) => sum + group.features.length, 0);
            const totalSubFeatures = parsedData.featureGroups.reduce((sum, group) => 
                sum + group.features.reduce((subSum, feature) => 
                    subSum + (feature.subFeatures ? feature.subFeatures.length : 0), 0), 0);
            
            // 统计test_level信息
            const testLevelCount = parsedData.testLevels ? parsedData.testLevels.length : 0;
            
            let successMessage = `✅ 成功解析Excel文件！
• ${parsedData.featureGroups.length} 个feature group
• ${totalFeatures} 个feature tag
• ${totalSubFeatures} 个sub feature tag`;
            
            if (testLevelCount > 0) {
                successMessage += `\n• ${testLevelCount} 个测试级别: ${parsedData.testLevels.join(', ')}`;
            }
            
            this.showNotification(successMessage, 'success');
            
        } catch (error) {
            console.log(`❌ [解析失败] 错误: ${error.message}`);
            console.error('Excel解析失败:', error);
            this.showNotification(`❌ Excel解析失败: ${error.message}`, 'error');
            previewDiv.style.display = 'none';
        }
    }

    // 生成详细的Excel预览（集成调试工具的预览逻辑）
    generateDetailedExcelPreview(data) {
        const totalFeatures = data.featureGroups.reduce((sum, group) => sum + group.features.length, 0);
        const totalSubFeatures = data.featureGroups.reduce((sum, group) => 
            sum + group.features.reduce((subSum, feature) => 
                subSum + (feature.subFeatures ? feature.subFeatures.length : 0), 0), 0);

        // 统计test_level信息
        const testLevelCount = data.testLevels ? data.testLevels.length : 0;
        
        // 统计活跃的测试数据
        let totalActiveTests = 0;
        let totalEmptyTests = 0;
        
        if (data.testLevels) {
            data.featureGroups.forEach(group => {
                group.features.forEach(feature => {
                    Object.keys(feature.tests).forEach(testLevel => {
                        if (feature.tests[testLevel].isEmpty) {
                            totalEmptyTests++;
                        } else {
                            totalActiveTests++;
                        }
                    });
                    
                    if (feature.subFeatures) {
                        feature.subFeatures.forEach(subFeature => {
                            Object.keys(subFeature.tests).forEach(testLevel => {
                                if (subFeature.tests[testLevel].isEmpty) {
                                    totalEmptyTests++;
                                } else {
                                    totalActiveTests++;
                                }
                            });
                        });
                    }
                });
            });
        }

        let html = `
            <div style="background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="color: #2e7d32; margin-bottom: 10px;">
                    <i class="fas fa-check-circle"></i> 解析成功！
                </h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-bottom: 10px;">
                    <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #4caf50;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #2e7d32;">${data.featureGroups.length}</div>
                        <div style="font-size: 0.8rem; color: #666;">feature group</div>
                    </div>
                    <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #2196f3;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #1976d2;">${totalFeatures}</div>
                        <div style="font-size: 0.8rem; color: #666;">feature tag</div>
                    </div>
                    <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #ff9800;">
                        <div style="font-size: 1.2rem; font-weight: bold; color: #f57c00;">${totalSubFeatures}</div>
                        <div style="font-size: 0.8rem; color: #666;">sub feature tag</div>
                    </div>
                    ${testLevelCount > 0 ? `
                        <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #9c27b0;">
                            <div style="font-size: 1.2rem; font-weight: bold; color: #7b1fa2;">${testLevelCount}</div>
                            <div style="font-size: 0.8rem; color: #666;">测试级别</div>
                        </div>
                        <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #4caf50;">
                            <div style="font-size: 1.2rem; font-weight: bold; color: #2e7d32;">${totalActiveTests}</div>
                            <div style="font-size: 0.8rem; color: #666;">活跃测试</div>
                        </div>
                        <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #9e9e9e;">
                            <div style="font-size: 1.2rem; font-weight: bold; color: #616161;">${totalEmptyTests}</div>
                            <div style="font-size: 0.8rem; color: #666;">空测试</div>
                        </div>
                    ` : ''}
                </div>
                <div style="font-size: 0.9rem; color: #666;">
                    <strong>数据来源：</strong>${data.source || 'Excel文件'} | 
                    <strong>解析时间：</strong>${new Date().toLocaleString()}
                </div>
                ${testLevelCount > 0 ? `
                    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 12px; border-radius: 8px; margin-top: 15px; border-left: 4px solid var(--info-color);">
                        <strong>🏷️ 识别的测试级别 (${testLevelCount}个):</strong><br>
                        <div style="margin-top: 8px; font-size: 0.9em;">
                            ${data.testLevels.map(level => `<span style="background: white; padding: 3px 8px; border-radius: 12px; margin-right: 8px; display: inline-block; margin-bottom: 4px;">${level}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            <div style="max-height: 300px; overflow-y: auto;">
        `;
        
        data.featureGroups.forEach((group, groupIndex) => {
            const groupSubFeatures = group.features.reduce((sum, f) => sum + (f.subFeatures ? f.subFeatures.length : 0), 0);
            
            html += `
                <div style="background: white; border-radius: 8px; padding: 12px; margin-bottom: 10px; border-left: 4px solid #4caf50; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="font-weight: bold; color: #2e7d32; margin-bottom: 8px;">
                        <i class="fas fa-layer-group"></i> ${groupIndex + 1}. ${group.name}
                        <span style="color: #666; font-weight: normal; font-size: 0.9rem;">(${group.features.length}个feature tag${groupSubFeatures > 0 ? ', ' + groupSubFeatures + '个sub feature tag' : ''})</span>
                    </div>
            `;
            
            group.features.forEach((feature, featureIndex) => {
                html += `
                    <div style="background: #f8f9fa; border-radius: 6px; padding: 8px; margin: 5px 0; border-left: 3px solid #2196f3;">
                        <div style="font-weight: 500; color: #1976d2;">
                            <i class="fas fa-cog"></i> ${feature.name}
                            ${feature.owner ? `<span style="color: #666; font-size: 0.8rem;">(${feature.owner})</span>` : ''}
                        </div>
                `;
                
                // 显示test_level信息
                if (data.testLevels && feature.tests) {
                    html += `<div style="margin-top: 5px; font-size: 0.8rem;">`;
                    data.testLevels.forEach(testLevel => {
                        const testData = feature.tests[testLevel];
                        if (testData) {
                            const icon = testData.isEmpty ? '⚫' : '●';
                            const style = testData.isEmpty ? 'color: #999; opacity: 0.6;' : 'color: #6c757d;';
                            const confidenceInfo = testData.confidence && !testData.isEmpty ? ` (${testData.confidence})` : '';
                            html += `<span style="${style}">${icon} ${testLevel}: ${testData.time}min${confidenceInfo}</span> `;
                        }
                    });
                    html += `</div>`;
                } else {
                    // 兼容老格式
                    html += `<div style="font-size: 0.8rem; color: #666; margin-top: 3px;">
                        CI: ${feature.tests.ci_night ? feature.tests.ci_night.time : 'N/A'}min | 
                        Regression: ${feature.tests.regression ? feature.tests.regression.time : 'N/A'}min
                    </div>`;
                }
                
                if (feature.subFeatures && feature.subFeatures.length > 0) {
                    feature.subFeatures.forEach(subFeature => {
                        html += `
                            <div style="background: #e3f2fd; border-radius: 4px; padding: 6px; margin: 3px 0 3px 20px; border-left: 2px solid #ff9800; font-size: 0.9em;">
                                <i class="fas fa-angle-right" style="color: #ff9800;"></i> ${subFeature.name}
                                ${subFeature.owner ? `<span style="color: #666; font-size: 0.8rem;">(${subFeature.owner})</span>` : ''}
                        `;
                        
                        // 子功能的test_level信息
                        if (data.testLevels && subFeature.tests) {
                            html += `<div style="margin-top: 3px; font-size: 0.75rem;">`;
                            data.testLevels.forEach(testLevel => {
                                const testData = subFeature.tests[testLevel];
                                if (testData) {
                                    const icon = testData.isEmpty ? '⚫' : '●';
                                    const style = testData.isEmpty ? 'color: #999; opacity: 0.6;' : 'color: #6c757d;';
                                    const confidenceInfo = testData.confidence && !testData.isEmpty ? ` (${testData.confidence})` : '';
                                    html += `<span style="${style}">${icon} ${testLevel}: ${testData.time}min${confidenceInfo}</span> `;
                                }
                            });
                            html += `</div>`;
                        } else {
                            // 兼容老格式
                            html += `<div style="font-size: 0.8rem; color: #666;">
                                CI: ${subFeature.tests.ci_night ? subFeature.tests.ci_night.time : 'N/A'}min | 
                                Regression: ${subFeature.tests.regression ? subFeature.tests.regression.time : 'N/A'}min
                            </div>`;
                        }
                        
                        html += `</div>`;
                    });
                }
                
                html += `</div>`;
            });
            
            html += `</div>`;
        });
        
        html += `</div>`;
        return html;
    }

    convertExcelToFeatureData(excelData) {
        console.log('🔄 [数据转换] 开始转换Excel数据为功能数据结构...');
        
        if (!excelData || excelData.length < 3) {
            throw new Error('Excel数据为空或格式不正确，至少需要3行（两行表头+数据行）');
        }

        // 分析表头结构（第一行和第二行）
        const firstRow = excelData[0].map(h => {
            if (h === null || h === undefined || h === '') return '';
            return h.toString().trim();
        });
        
        const secondRow = excelData[1].map(h => {
            if (h === null || h === undefined || h === '') return '';
            return h.toString().toLowerCase().trim();
        });

        console.log(`📋 [表头解析] 第一行表头: ${firstRow.join(' | ')}`);
        console.log(`📋 [表头解析] 第二行表头: ${secondRow.join(' | ')}`);

        // 识别基础列 - 在第一行表头中寻找
        const firstRowLower = firstRow.map(h => h.toLowerCase().trim());
        const basicColumns = {
            featureGroup: this.findExactColumnIndex(firstRowLower, ['feature group', 'featuregroup']),
            featureTag: this.findExactColumnIndex(firstRowLower, ['feature tag', 'featuretag']),
            subFeatureTag: this.findExactColumnIndex(firstRowLower, ['sub feature tag', 'subfeaturetag']),
            suiteName: this.findExactColumnIndex(firstRowLower, ['suite name', 'suitename']),
            owner: this.findExactColumnIndex(firstRowLower, ['owner']),
            remark: this.findExactColumnIndex(firstRowLower, ['remark'])
        };

        console.log(`🗂️ [列映射] Feature Group: ${basicColumns.featureGroup}, Feature Tag: ${basicColumns.featureTag}, Sub Feature Tag: ${basicColumns.subFeatureTag}`);
        console.log(`🗂️ [列映射] Suite Name: ${basicColumns.suiteName}, Owner: ${basicColumns.owner}, Remark: ${basicColumns.remark}`);

        if (basicColumns.featureGroup === -1) throw new Error('未找到 "Feature Group" 列');
        if (basicColumns.featureTag === -1) throw new Error('未找到 "Feature Tag" 列');

        // 动态识别test_level结构
        const testLevels = this.identifyTestLevels(firstRow, secondRow, basicColumns);
        console.log(`🏷️ [测试级别识别] 识别到 ${testLevels.length} 个test_level: ${testLevels.map(tl => tl.name).join(', ')}`);

        // 处理数据行
        const groupsMap = new Map();
        let processedRows = 0;
        let subFeatureCount = 0;
        let currentFeatureGroup = '';
        let currentFeatureTag = '';
        
        // 从第3行开始处理数据（跳过两行表头）
        for (let i = 2; i < excelData.length; i++) {
            const row = excelData[i];
            if (!row || row.length === 0) continue;

            try {
                let featureGroupName = this.getCellValue(row, basicColumns.featureGroup);
                let featureTagName = this.getCellValue(row, basicColumns.featureTag);
                const subFeatureTagName = this.getCellValue(row, basicColumns.subFeatureTag);
                const suiteName = this.getCellValue(row, basicColumns.suiteName);
                const owner = this.getCellValue(row, basicColumns.owner);
                const remark = this.getCellValue(row, basicColumns.remark);

                console.log(`📍 [行数据调试] 第 ${i + 1} 行: Group="${featureGroupName}" Tag="${featureTagName}" SubTag="${subFeatureTagName}" Suite="${suiteName}" Owner="${owner}"`);

                // 处理合并单元格
                if (!featureGroupName && featureTagName && currentFeatureGroup) {
                    featureGroupName = currentFeatureGroup;
                    console.log(`🔗 [合并单元格处理] 第 ${i + 1} 行: 使用上级功能组 "${currentFeatureGroup}"`);
                } else if (featureGroupName) {
                    currentFeatureGroup = featureGroupName;
                }

                // 处理子功能行
                if (!featureGroupName && !featureTagName && subFeatureTagName && currentFeatureGroup && currentFeatureTag) {
                    featureGroupName = currentFeatureGroup;
                    featureTagName = currentFeatureTag;
                    console.log(`🔀 [子功能行处理] 第 ${i + 1} 行: 检测到子功能行，使用功能组 "${currentFeatureGroup}" 和功能标签 "${currentFeatureTag}"`);
                } else if (featureTagName) {
                    currentFeatureTag = featureTagName;
                }

                if (!featureGroupName || !featureTagName) {
                    console.log(`⚠️ [行跳过] 第 ${i + 1} 行: 缺少必需字段，跳过处理`);
                    continue;
                }

                // 解析每个test_level的数据
                const testsData = {};
                for (const testLevel of testLevels) {
                    const testData = this.extractTestLevelData(row, testLevel);
                    testsData[testLevel.name] = testData;
                    
                    if (testData.description) {
                        console.log(`🎯 [测试数据提取] ${testLevel.name}: "${testData.description}" (${testData.time}min, ${testData.qty}cases, ${testData.confidence})`);
                    } else {
                        console.log(`⚪ [测试数据提取] ${testLevel.name}: 空数据`);
                    }
                }

                // 创建功能组
                if (!groupsMap.has(featureGroupName)) {
                    groupsMap.set(featureGroupName, {
                        id: this.generateId(featureGroupName),
                        name: featureGroupName,
                        description: '',
                        features: new Map()
                    });
                    console.log(`✅ [功能组创建] 创建功能组: ${featureGroupName}`);
                }

                const group = groupsMap.get(featureGroupName);

                // 创建或更新功能
                if (!group.features.has(featureTagName)) {
                    group.features.set(featureTagName, {
                        id: this.generateId(featureTagName),
                        name: featureTagName,
                        suiteName: suiteName,
                        owner: owner,
                        remark: remark,
                        tests: testsData,
                        subFeatures: []
                    });
                    console.log(`✅ [功能创建] 创建功能: ${featureTagName}`);
                }

                const feature = group.features.get(featureTagName);

                // 处理子功能
                if (subFeatureTagName) {
                    const subFeature = {
                        id: this.generateId(`${featureTagName}_${subFeatureTagName}`),
                        name: subFeatureTagName,
                        suiteName: suiteName,
                        owner: owner,
                        remark: remark,
                        tests: testsData
                    };

                    const existingSubFeature = feature.subFeatures.find(sf => sf.name === subFeatureTagName);
                    if (!existingSubFeature) {
                        feature.subFeatures.push(subFeature);
                        subFeatureCount++;
                        console.log(`✅ [子功能创建] 创建子功能: ${subFeatureTagName} (属于 ${featureTagName})`);
                    }
                }

                processedRows++;

            } catch (error) {
                console.log(`❌ [行处理错误] 第 ${i + 1} 行处理失败: ${error.message}`);
            }
        }

        const featureGroups = Array.from(groupsMap.values()).map(group => ({
            ...group,
            features: Array.from(group.features.values())
        }));

        const result = {
            featureGroups: featureGroups,
            testLevels: testLevels.map(tl => tl.name),
            source: 'Excel解析 - 增强版',
            lastUpdated: new Date().toISOString()
        };

        console.log(`✅ [转换完成] 处理了 ${processedRows} 行数据，创建了 ${groupsMap.size} 个功能组，${subFeatureCount} 个子功能`);
        return result;
    }

    // 动态识别test_level的方法
    identifyTestLevels(firstRow, secondRow, basicColumns) {
        const testLevels = [];
        const testLevelNames = new Set();
        
        // 寻找test_level区域（从基础列之后开始，到remark之前）
        let startCol = Math.max(
            basicColumns.featureGroup,
            basicColumns.featureTag,
            basicColumns.subFeatureTag,
            basicColumns.suiteName || -1,
            basicColumns.owner || -1
        ) + 1;
        
        let endCol = basicColumns.remark !== -1 ? basicColumns.remark : firstRow.length;

        console.log(`🔍 [测试级别范围] 搜索范围: 列 ${startCol} 到 ${endCol}`);

        // 在第一行中寻找test_level名称
        for (let i = startCol; i < endCol; i++) {
            const cellValue = firstRow[i];
            if (cellValue && cellValue.trim() && !testLevelNames.has(cellValue.trim())) {
                // 检查是否有对应的4列属性
                const hasValidStructure = this.validateTestLevelStructure(secondRow, i);
                if (hasValidStructure) {
                    const testLevelName = cellValue.trim().toLowerCase().replace(/\s+/g, '_');
                    testLevels.push({
                        name: testLevelName,
                        originalName: cellValue.trim(),
                        startColumn: i,
                        columns: {
                            description: i,
                            qty: i + 1,
                            time: i + 2,
                            confidence: i + 3
                        }
                    });
                    testLevelNames.add(cellValue.trim());
                    console.log(`🎯 [测试级别发现] 发现test_level: "${cellValue.trim()}" 起始列: ${i}`);
                }
            }
        }

        return testLevels;
    }

    // 验证test_level结构的方法
    validateTestLevelStructure(secondRow, startCol) {
        const expectedAttrs = ['test des.', 'test qty', 'test time', 'confidence'];
        
        for (let i = 0; i < 4; i++) {
            const colIndex = startCol + i;
            if (colIndex >= secondRow.length) return false;
            
            const cellValue = secondRow[colIndex];
            if (!cellValue) return false;
            
            const found = expectedAttrs.some(attr => 
                cellValue.includes(attr) || 
                cellValue.includes(attr.replace('.', '').replace(' ', ''))
            );
            
            if (!found) {
                console.log(`⚠️ [结构验证] 列 ${colIndex} ("${cellValue}") 不匹配预期属性`);
                return false;
            }
        }
        
        return true;
    }

    // 提取test_level数据的方法
    extractTestLevelData(row, testLevel) {
        const description = this.getCellValue(row, testLevel.columns.description);
        const qty = this.parseNumber(this.getCellValue(row, testLevel.columns.qty));
        const time = this.parseTime(this.getCellValue(row, testLevel.columns.time));
        const confidence = this.getCellValue(row, testLevel.columns.confidence);
        
        // 判断是否为空数据：描述为空或时间为0
        const isEmpty = !description || time === 0;
        
        return {
            description: description,
            qty: qty,
            time: time,
            confidence: confidence,
            isEmpty: isEmpty
        };
    }

    // 精确列索引查找
    findExactColumnIndex(headers, searchTerms) {
        for (const term of searchTerms) {
            const index = headers.findIndex(h => h && h.toLowerCase().trim() === term.toLowerCase());
            if (index !== -1) return index;
        }
        // 如果精确匹配失败，尝试包含匹配
        for (const term of searchTerms) {
            const index = headers.findIndex(h => h && h.toLowerCase().includes(term.toLowerCase()));
            if (index !== -1) return index;
        }
        return -1;
    }

    // 测试函数
    testExcelParsing() {
        console.log('🧪 测试Excel解析逻辑...');
        
        const mockExcelData = [
            ['Feature Group', 'Feature Tag', 'Sub Feature Tag', 'Test Description', 'Suite Directory', 'Owner', 'test_Qty', 'test_time', 'confidence', 'remark'],
            ['MPLS-TP Tunnel and Service', 'tp_tunnels', '', 'TP隧道基础测试', '024_TP_Tunnels', 'TangYanli', '2', '10', 'high', ''],
            ['MPLS-TP Tunnel and Service', 'l2_service', 'basic_l2', 'L2基础服务测试', '025_L2_Service', 'TangYanli', '3', '15', 'medium', ''],
            ['MPLS-TP Tunnel and Service', 'l2_service', 'advanced_l2', 'L2高级服务测试', '025_L2_Service', 'TangYanli', '4', '20', 'high', '测试备注'],
            ['Router Features', 'bgp_routing', '', 'BGP路由协议测试', '030_BGP', 'LiMing', '5', '1h 30m', 'high', '']
        ];

        try {
            const parsedData = this.convertExcelToFeatureData(mockExcelData);
            console.log('✅ Excel解析测试成功:', parsedData);
            this.showNotification(`🧪 Excel解析测试：成功解析 ${parsedData.featureGroups.length} 个功能组`, 'success');
            
            if (confirm('是否将测试数据应用到界面？')) {
                this.currentData = parsedData;
                this.renderFeatureGroups();
                this.updateDisplay();
            }
        } catch (error) {
            console.error('❌ Excel解析测试失败:', error);
            this.showNotification(`🧪 Excel解析测试失败: ${error.message}`, 'error');
        }
    }

    testMultiLevelFeatures() {
        const multiLevelData = {
            featureGroups: [
                {
                    id: 'test_multi_level',
                    name: '多层级测试组',
                    description: '测试多层级功能展示',
                    features: [
                        {
                            id: 'parent_feature_1',
                            name: '父功能1',
                            description: '包含多个子功能的父功能',
                            tests: {
                                ci_night: { time: 5, description: '父功能1 CI测试' },
                                regression: { time: 10, description: '父功能1 回归测试' }
                            },
                            subFeatures: [
                                {
                                    id: 'sub_feature_1_1',
                                    name: '子功能1-1',
                                    description: '第一个子功能',
                                    owner: 'TestUser1',
                                    tests: {
                                        ci_night: { time: 8, description: '子功能1-1 CI测试' },
                                        regression: { time: 16, description: '子功能1-1 回归测试' }
                                    }
                                },
                                {
                                    id: 'sub_feature_1_2',
                                    name: '子功能1-2',
                                    description: '第二个子功能',
                                    owner: 'TestUser2',
                                    tests: {
                                        ci_night: { time: 12, description: '子功能1-2 CI测试' },
                                        regression: { time: 24, description: '子功能1-2 回归测试' }
                                    }
                                }
                            ]
                        },
                        {
                            id: 'single_feature_1',
                            name: '单独功能1',
                            description: '没有子功能的单独功能',
                            owner: 'TestUser3',
                            tests: {
                                ci_night: { time: 15, description: '单独功能1 CI测试' },
                                regression: { time: 30, description: '单独功能1 回归测试' }
                            }
                        }
                    ]
                }
            ],
            source: '多层级测试数据',
            lastUpdated: new Date().toISOString()
        };

        this.currentData = multiLevelData;
        this.renderFeatureGroups();
        this.updateDisplay();
        this.showNotification('🧪 多层级功能测试数据已加载', 'success');
    }

    testSubFeatureGroups() {
        this.currentData.featureGroups.forEach(group => {
            this.expandedGroups.add(group.id);
            group.features.forEach(feature => {
                if (feature.subFeatures && feature.subFeatures.length > 0) {
                    this.expandedSubGroups.add(feature.id);
                }
            });
        });
        this.renderFeatureGroups();
        this.showNotification('🧪 已展开所有子功能组，可以测试折叠/展开功能', 'info');
    }

    testRenderFunction() {
        this.renderFeatureGroups();
        this.updateDisplay();
        this.showNotification('🧪 界面重新渲染完成', 'success');
    }

    testWithRealData() {
        this.currentData = testFeatureData;
        this.renderFeatureGroups();
        this.updateDisplay();
        this.showNotification('🧪 测试数据已加载', 'success');
    }

    // 从debug-excel.html移植的方法 - 确保完全兼容
    findColumnIndex(headers, searchTerms) {
        for (const term of searchTerms) {
            const index = headers.findIndex(h => h && h.includes(term.toLowerCase()));
            if (index !== -1) return index;
        }
        return -1;
    }

    getCellValue(row, columnIndex) {
        if (columnIndex === -1 || !row || row.length <= columnIndex) return '';
        const value = row[columnIndex];
        if (value === null || value === undefined || value === '') return '';
        try {
            return value.toString().trim();
        } catch (error) {
            console.warn('⚠️ [单元格值错误] 无法转换单元格值:', value, error);
            return '';
        }
    }

    parseExcelNumber(value) {
        if (!value || value.toString().trim() === '') return 0;
        const num = parseInt(value.toString().replace(/[^\d]/g, ''));
        const result = isNaN(num) ? 0 : num;
        console.log(`🔢 [数量解析] "${value}" -> ${result}`);
        return result;
    }

    // 直接实现parseNumber方法，避免this上下文问题
    parseNumber(value) {
        if (!value || value.toString().trim() === '') return 0;
        const num = parseInt(value.toString().replace(/[^\d]/g, ''));
        const result = isNaN(num) ? 0 : num;
        console.log(`🔢 [数量解析] "${value}" -> ${result}`);
        return result;
    }

    parseExcelTime(value) {
        if (!value || value.toString().trim() === '') return 0;
        const str = value.toString().toLowerCase().trim();
        
        // 匹配各种时间格式：6h, 60m, 2h30m, 90分钟, 1小时30分钟
        // 优先匹配带单位的格式
        
        // 匹配 "2h30m" 或 "2小时30分钟" 格式
        let hoursMinutesMatch = str.match(/(\d+)(?:h|小时)\s*(\d+)(?:m|分钟?)/);
        if (hoursMinutesMatch) {
            const hours = parseInt(hoursMinutesMatch[1]) || 0;
            const minutes = parseInt(hoursMinutesMatch[2]) || 0;
            console.log(`🕐 [时间解析] "${value}" -> ${hours}小时${minutes}分钟 = ${hours * 60 + minutes}分钟`);
            return hours * 60 + minutes;
        }
        
        // 匹配纯小时格式：6h, 6小时
        let hoursMatch = str.match(/^(\d+)(?:h|小时)$/);
        if (hoursMatch) {
            const hours = parseInt(hoursMatch[1]) || 0;
            console.log(`🕐 [时间解析] "${value}" -> ${hours}小时 = ${hours * 60}分钟`);
            return hours * 60;
        }
        
        // 匹配纯分钟格式：60m, 60分钟
        let minutesMatch = str.match(/^(\d+)(?:m|分钟?)$/);
        if (minutesMatch) {
            const minutes = parseInt(minutesMatch[1]) || 0;
            console.log(`🕐 [时间解析] "${value}" -> ${minutes}分钟`);
            return minutes;
        }
        
        // 如果没有单位，尝试解析纯数字（默认为分钟）
        const num = parseInt(str.replace(/[^\d]/g, ''));
        if (!isNaN(num) && num > 0) {
            console.log(`🕐 [时间解析] "${value}" -> ${num}分钟（无单位，默认分钟）`);
            return num;
        }
        
        console.log(`⚠️ [时间解析] "${value}" -> 无法解析，返回0`);
        return 0;
    }

    // 直接实现parseTime方法，避免this上下文问题
    parseTime(value) {
        if (!value || value.toString().trim() === '') return 0;
        const str = value.toString().toLowerCase().trim();
        
        // 匹配各种时间格式：6h, 60m, 2h30m, 90分钟, 1小时30分钟
        // 优先匹配带单位的格式
        
        // 匹配 "2h30m" 或 "2小时30分钟" 格式
        let hoursMinutesMatch = str.match(/(\d+)(?:h|小时)\s*(\d+)(?:m|分钟?)/);
        if (hoursMinutesMatch) {
            const hours = parseInt(hoursMinutesMatch[1]) || 0;
            const minutes = parseInt(hoursMinutesMatch[2]) || 0;
            console.log(`🕐 [时间解析] "${value}" -> ${hours}小时${minutes}分钟 = ${hours * 60 + minutes}分钟`);
            return hours * 60 + minutes;
        }
        
        // 匹配纯小时格式：6h, 6小时
        let hoursMatch = str.match(/^(\d+)(?:h|小时)$/);
        if (hoursMatch) {
            const hours = parseInt(hoursMatch[1]) || 0;
            console.log(`🕐 [时间解析] "${value}" -> ${hours}小时 = ${hours * 60}分钟`);
            return hours * 60;
        }
        
        // 匹配纯分钟格式：60m, 60分钟
        let minutesMatch = str.match(/^(\d+)(?:m|分钟?)$/);
        if (minutesMatch) {
            const minutes = parseInt(minutesMatch[1]) || 0;
            console.log(`🕐 [时间解析] "${value}" -> ${minutes}分钟`);
            return minutes;
        }
        
        // 如果没有单位，尝试解析纯数字（默认为分钟）
        const num = parseInt(str.replace(/[^\d]/g, ''));
        if (!isNaN(num) && num > 0) {
            console.log(`🕐 [时间解析] "${value}" -> ${num}分钟（无单位，默认分钟）`);
            return num;
        }
        
        console.log(`⚠️ [时间解析] "${value}" -> 无法解析，返回0`);
        return 0;
    }

    generateExcelId(name) {
        return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    }

    // 直接实现generateId方法，避免this上下文问题
    generateId(name) {
        return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
    }

    generateExcelPreview(data) {
        let html = `<strong>解析结果：</strong><br>功能组数量: ${data.featureGroups.length}<br><br>`;
        
        data.featureGroups.forEach((group, index) => {
            const totalFeatures = group.features.length;
            const totalSubFeatures = group.features.reduce((sum, f) => sum + (f.subFeatures ? f.subFeatures.length : 0), 0);
            
            html += `<div style="margin-bottom: 10px; padding: 8px; background: white; border-radius: 3px;">`;
            html += `<strong>${index + 1}. ${group.name}</strong> (${totalFeatures}个功能`;
            if (totalSubFeatures > 0) html += `, ${totalSubFeatures}个子功能`;
            html += `)<br>`;
            
            group.features.slice(0, 3).forEach(feature => {
                html += `&nbsp;&nbsp;• ${feature.name}`;
                if (feature.subFeatures && feature.subFeatures.length > 0) {
                    html += ` [${feature.subFeatures.length}个子功能]`;
                }
                html += `<br>`;
            });
            
            if (group.features.length > 3) {
                html += `&nbsp;&nbsp;... 还有 ${group.features.length - 3} 个功能<br>`;
            }
            html += `</div>`;
        });
        
        return html;
    }

    // ===== 配置历史功能（服务器版） =====
    
    // 保存配置到服务器
    async saveSavedConfigs() {
        try {
            await this.serverDataManager.saveConfigs(this.savedConfigs);
            console.log('✅ 配置已保存到服务器');
        } catch (error) {
            console.error('❌ 保存配置到服务器失败:', error);
            this.showNotification('保存配置失败，已降级到本地存储', 'warning');
        }
    }

    // 更新配置历史显示
    updateConfigHistoryDisplay() {
        const container = document.getElementById('configHistoryList');
        if (!container) return;

        // 使用过滤后的配置列表
        const configsToShow = this.filteredConfigs.length > 0 ? this.filteredConfigs : 
                             (this.configSearchTerm ? [] : this.savedConfigs);

        if (configsToShow.length === 0) {
            if (this.configSearchTerm) {
                container.innerHTML = '<p class="placeholder">No matching configs found</p>';
            } else {
                container.innerHTML = '<p class="placeholder">No saved configs</p>';
            }
            return;
        }

        let html = '';
        configsToShow.forEach(config => {
            const configDate = new Date(config.createdAt).toLocaleDateString();
            const totalTests = config.tests.length;
            const totalTime = config.tests.reduce((sum, test) => sum + test.time, 0);
            
            // 检查是否为当前活跃配置
            const isActiveConfig = this.activeConfig && this.activeConfig.id === config.id;
            const activeClass = isActiveConfig ? 'active' : '';
            const activeIndicator = isActiveConfig ? '<i class="fas fa-edit config-editing-icon" title="Currently Editing"></i>' : '';
            
            // 生成修改历史信息
            const lastModification = config.modificationHistory && config.modificationHistory.length > 0 
                ? config.modificationHistory[0] : null;
            
            const modificationInfo = lastModification ? `
                <div class="last-modification-info">
                    <i class="fas fa-user-edit"></i> ${lastModification.modifier} 
                    ${lastModification.reason ? `· ${lastModification.reason.substring(0, 30)}${lastModification.reason.length > 30 ? '...' : ''}` : ''}
                    <span class="modification-time">· ${new Date(lastModification.timestamp).toLocaleString()}</span>
                </div>
            ` : '';

            const historyBtnHtml = config.modificationHistory && config.modificationHistory.length > 0 ? `
                <button class="config-action-btn history" onclick="window.testApp.showModificationHistory('${config.id}')" title="View History">
                    <i class="fas fa-history"></i>
                </button>
            ` : '';
            
            html += `
                <div class="config-item ${activeClass}" data-config-id="${config.id}">
                    <div class="config-item-header">
                        <div>
                            <div class="config-item-name" title="${this.escapeHtml(config.name)}">
                                ${activeIndicator}${config.name}
                                ${isActiveConfig && this.hasUnsavedChanges ? '<span class="unsaved-changes-indicator">*</span>' : ''}
                            </div>
                            ${config.description ? this.renderConfigDescription(config.description, config.id) : '<div class="config-item-description">No description</div>'}
                        </div>
                        <div class="config-item-actions">
                            <button class="config-action-btn apply" onclick="window.testApp.applyConfig('${config.id}')" title="Load Config">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="config-action-btn edit" onclick="window.testApp.editConfig('${config.id}')" title="Edit Name">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="config-action-btn export" onclick="window.testApp.exportSingleConfig('${config.id}')" title="Export Config">
                                <i class="fas fa-file-export"></i>
                            </button>
                            <button class="config-action-btn import" onclick="window.testApp.importSingleConfig('${config.id}')" title="Import & Replace">
                                <i class="fas fa-file-import"></i>
                            </button>
                            <button class="config-action-btn delete" onclick="window.testApp.deleteConfig('${config.id}')" title="Delete Config">
                                <i class="fas fa-trash"></i>
                            </button>
                            ${historyBtnHtml}
                        </div>
                    </div>
                    <div class="config-item-info">
                        <div class="config-stats">
                            <span><i class="fas fa-tags"></i> ${totalTests} tags</span>
                            <span><i class="fas fa-clock"></i> ${formatTime(totalTime)}</span>
                            <span><i class="fas fa-calendar"></i> ${configDate}</span>
                        </div>
                        ${modificationInfo}
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    // 渲染配置描述，支持展开/折叠
    renderConfigDescription(description, configId) {
        const descriptionId = `desc-${configId}`;
        const maxLength = 80;
        const needsToggle = description.length > maxLength;
        
        if (!needsToggle) {
            return `<div class="config-item-description">${this.escapeHtml(description)}</div>`;
        }
        
        const shortText = description.substring(0, maxLength);
        
        return `
            <div class="config-item-description" id="${descriptionId}">
                <span class="description-text">${this.escapeHtml(shortText)}...</span>
                <span class="description-full" style="display: none;">${this.escapeHtml(description)}</span>
                <button class="description-toggle" onclick="window.testApp.toggleConfigDescription('${descriptionId}')" title="Toggle description">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        `;
    }

    // 切换配置描述的展开/折叠状态
    toggleConfigDescription(descriptionId) {
        const descElement = document.getElementById(descriptionId);
        if (!descElement) return;
        
        const shortText = descElement.querySelector('.description-text');
        const fullText = descElement.querySelector('.description-full');
        const toggleBtn = descElement.querySelector('.description-toggle');
        const icon = toggleBtn.querySelector('i');
        
        const isExpanded = fullText.style.display !== 'none';
        
        if (isExpanded) {
            // 折叠
            shortText.style.display = 'inline';
            fullText.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
            toggleBtn.classList.remove('expanded');
            descElement.classList.remove('expanded');
        } else {
            // 展开
            shortText.style.display = 'none';
            fullText.style.display = 'inline';
            icon.className = 'fas fa-chevron-up';
            toggleBtn.classList.add('expanded');
            descElement.classList.add('expanded');
        }
    }

    // HTML转义函数，防止XSS攻击
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 更新保存按钮状态
    updateSaveButton() {
        const saveBtn = document.getElementById('saveConfigBtn');
        if (!saveBtn) return;
        
        const hasSelections = this.selectedTests.length > 0;
        saveBtn.disabled = !hasSelections;
        
        if (hasSelections) {
            saveBtn.innerHTML = `<i class="fas fa-save"></i> Save config (${this.selectedTests.length})`;
        } else {
            saveBtn.innerHTML = `<i class="fas fa-save"></i> Save config`;
        }
    }

    // 更新生成按钮状态
    updateGenerateButton() {
        const generateBtn = document.getElementById('generateBtn');
        const clearBtn = document.getElementById('clearAllBtn');
        
        if (!generateBtn || !clearBtn) return;
        
        const hasSelections = this.selectedTests.length > 0;
        
        // 更新生成按钮
        generateBtn.disabled = !hasSelections;
        if (hasSelections) {
            generateBtn.classList.add('ready');
            generateBtn.innerHTML = `<i class="fas fa-terminal"></i> Generate (${this.selectedTests.length})`;
        } else {
            generateBtn.classList.remove('ready');
            generateBtn.innerHTML = `<i class="fas fa-terminal"></i> Generate`;
        }
        
        // 更新清空按钮
        clearBtn.disabled = !hasSelections;
        if (hasSelections) {
            clearBtn.classList.add('ready');
            clearBtn.innerHTML = `<i class="fas fa-trash-alt"></i> Clear (${this.selectedTests.length})`;
        } else {
            clearBtn.classList.remove('ready');
            clearBtn.innerHTML = `<i class="fas fa-trash-alt"></i> Clear`;
        }
    }

    // 显示保存配置模态框
    showSaveConfigModal() {
        if (this.selectedTests.length === 0) {
            this.showNotification('Please select test items first', 'warning');
            return;
        }

        const modal = document.getElementById('saveConfigModal');
        const nameInput = document.getElementById('configName');
        const descInput = document.getElementById('configDescription');
        
        // 生成智能的配置名称（使用增强版本，包含功能提示）
        const suggestedName = this.generateSmartConfigNameWithFeature();
        nameInput.value = suggestedName;
        descInput.value = '';
        
        // 更新预览
        this.updateConfigPreview();
        
        // 绑定事件
        this.bindSaveConfigModalEvents();
        
        modal.style.display = 'flex';
    }

    // 生成智能的配置名称
    generateSmartConfigName() {
        const today = new Date().toISOString().slice(0, 10);
        const basePrefix = `config-${today}`;
        
        // 检查是否已存在相同日期的配置
        const existingConfigs = this.savedConfigs.filter(config => 
            config.name.startsWith(basePrefix)
        );
        
        if (existingConfigs.length === 0) {
            // 如果没有同日期的配置，使用基础名称
            return basePrefix;
        }
        
        // 如果存在同日期的配置，添加序号
        let counter = 1;
        let suggestedName;
        
        do {
            suggestedName = `${basePrefix}-${counter}`;
            counter++;
        } while (this.savedConfigs.some(config => config.name === suggestedName));
        
        return suggestedName;
    }

    // 生成带功能提示的智能配置名称（备选方案）
    generateSmartConfigNameWithFeature() {
        const today = new Date().toISOString().slice(0, 10);
        const basePrefix = `config-${today}`;
        
        // 获取主要功能组或功能名称作为提示
        let featureHint = '';
        if (this.selectedTests.length > 0) {
            // 统计最常见的功能组
            const groupCounts = {};
            this.selectedTests.forEach(test => {
                const groupName = test.groupName || 'unknown';
                const shortGroupName = groupName.toLowerCase()
                    .replace(/\s+/g, '_')
                    .replace(/[^a-z0-9_]/g, '')
                    .substring(0, 15); // 限制长度
                groupCounts[shortGroupName] = (groupCounts[shortGroupName] || 0) + 1;
            });
            
            // 找出最常见的功能组
            const mostCommonGroup = Object.keys(groupCounts).reduce((a, b) => 
                groupCounts[a] > groupCounts[b] ? a : b
            );
            
            if (mostCommonGroup && mostCommonGroup !== 'unknown') {
                featureHint = `-${mostCommonGroup}`;
            }
        }
        
        const baseNameWithFeature = `${basePrefix}${featureHint}`;
        
        // 检查是否已存在相同名称的配置
        const existingConfigs = this.savedConfigs.filter(config => 
            config.name.startsWith(baseNameWithFeature)
        );
        
        if (existingConfigs.length === 0) {
            return baseNameWithFeature;
        }
        
        // 如果存在，添加序号
        let counter = 1;
        let suggestedName;
        
        do {
            suggestedName = `${baseNameWithFeature}-${counter}`;
            counter++;
        } while (this.savedConfigs.some(config => config.name === suggestedName));
        
        return suggestedName;
    }

    // 生成替代配置名称（用于处理重复名称）
    generateAlternateName(originalName) {
        // 检查原名称是否已经有序号
        const numberMatch = originalName.match(/^(.+)-(\d+)$/);
        let baseName, startCounter;
        
        if (numberMatch) {
            // 如果已经有序号，从该序号开始递增
            baseName = numberMatch[1];
            startCounter = parseInt(numberMatch[2]) + 1;
        } else {
            // 如果没有序号，添加序号从1开始
            baseName = originalName;
            startCounter = 1;
        }
        
        // 找到可用的序号
        let counter = startCounter;
        let alternateName;
        
        do {
            alternateName = `${baseName}-${counter}`;
            counter++;
        } while (this.savedConfigs.some(config => config.name === alternateName));
        
        return alternateName;
    }

    // 更新配置预览
    updateConfigPreview() {
        const preview = document.getElementById('configPreview');
        if (!preview) return;
        
        let html = '';
        this.selectedTests.forEach(test => {
            html += `
                <div class="preview-item">
                    <span>${test.featureName}</span>
                    <span>${test.testType} (${formatTime(test.time)})</span>
                </div>
            `;
        });
        
        const totalTime = this.selectedTests.reduce((sum, test) => sum + test.time, 0);
        html += `
            <div class="preview-item" style="border-top: 2px solid var(--primary-color); margin-top: 8px; padding-top: 8px; font-weight: bold;">
                <span>Total</span>
                <span>${this.selectedTests.length} items · ${formatTime(totalTime)}</span>
            </div>
        `;
        
        preview.innerHTML = html;
    }

    // 绑定保存配置模态框事件
    bindSaveConfigModalEvents() {
        const modal = document.getElementById('saveConfigModal');
        const confirmBtn = document.getElementById('confirmSaveConfig');
        const cancelBtn = document.getElementById('cancelSaveConfig');
        const closeBtn = document.getElementById('closeSaveModal');
        const regenerateBtn = document.getElementById('regenerateConfigName');
        const nameInput = document.getElementById('configName');
        const descInput = document.getElementById('configDescription');
        
        // 移除旧的事件监听器（如果存在）
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        closeBtn.replaceWith(closeBtn.cloneNode(true));
        regenerateBtn.replaceWith(regenerateBtn.cloneNode(true));
        nameInput.replaceWith(nameInput.cloneNode(true));
        descInput.replaceWith(descInput.cloneNode(true));
        
        // 重新获取元素引用
        const newConfirmBtn = document.getElementById('confirmSaveConfig');
        const newCancelBtn = document.getElementById('cancelSaveConfig');
        const newCloseBtn = document.getElementById('closeSaveModal');
        const newRegenerateBtn = document.getElementById('regenerateConfigName');
        const newNameInput = document.getElementById('configName');
        const newDescInput = document.getElementById('configDescription');
        
        newConfirmBtn.addEventListener('click', () => this.saveCurrentConfig());
        newCancelBtn.addEventListener('click', () => this.closeSaveConfigModal());
        newCloseBtn.addEventListener('click', () => this.closeSaveConfigModal());
        
        // 重新生成配置名称
        newRegenerateBtn.addEventListener('click', () => {
            const suggestedName = this.generateSmartConfigNameWithFeature();
            newNameInput.value = suggestedName;
            this.updateConfigPreview();
            this.showNotification('已生成新的智能配置名称', 'success');
        });
        
        // 实时更新预览
        newNameInput.addEventListener('input', () => this.updateConfigPreview());
        newDescInput.addEventListener('input', () => this.updateConfigPreview());
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeSaveConfigModal();
        });
    }

    // 保存当前配置
    async saveCurrentConfig() {
        const nameInput = document.getElementById('configName');
        const descInput = document.getElementById('configDescription');
        
        const name = nameInput.value.trim();
        if (!name) {
            this.showNotification('请输入配置名称', 'warning');
            nameInput.focus();
            return;
        }
        
        // 检查名称是否重复
        if (this.savedConfigs.some(config => config.name === name)) {
            // 自动生成替代名称
            const alternateName = this.generateAlternateName(name);
            const confirmed = confirm(`配置名称 "${name}" 已存在。\n\n是否使用建议名称 "${alternateName}"？\n\n点击"确定"使用建议名称，点击"取消"手动修改。`);
            
            if (confirmed) {
                nameInput.value = alternateName;
                // 递归调用以防建议名称也重复
                this.saveCurrentConfig();
                return;
            } else {
                nameInput.focus();
                nameInput.select(); // 选中文本以便用户修改
                return;
            }
        }
        
        const config = {
            id: Date.now().toString(),
            name: name,
            description: descInput.value.trim(),
            tests: [...this.selectedTests],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.savedConfigs.push(config);
        await this.saveSavedConfigs();
        // 更新过滤列表
        this.filteredConfigs = [...this.savedConfigs];
        this.filteredConfigsForModal = [...this.savedConfigs];
        this.updateConfigHistoryDisplay();
        this.closeSaveConfigModal();
        
        this.showNotification(`配置 "${name}" 保存成功`, 'success');
    }

    // 关闭保存配置模态框
    closeSaveConfigModal() {
        document.getElementById('saveConfigModal').style.display = 'none';
    }

    // Load config
    applyConfig(configId) {
        const config = this.savedConfigs.find(c => c.id === configId);
        if (!config) {
            this.showNotification('Config not found', 'error');
            return;
        }
        
        // Clear current selections
        this.clearAllSelections();
        
        // Set active config state
        this.activeConfig = {
            id: config.id,
            name: config.name,
            originalTests: JSON.parse(JSON.stringify(config.tests)) // Deep copy original state
        };
        this.hasUnsavedChanges = false;
        
        // Apply config
        this.selectedTests = [...config.tests];
        
        // Update radio button states
        config.tests.forEach(test => {
            const radio = document.querySelector(`input[data-feature-id="${test.featureId}"][value="${test.testType}"]`);
            if (radio) {
                radio.checked = true;
            }
        });
        
        // Update display
        this.updateDisplay();
        this.updateActiveConfigIndicator();
        this.updateConfigHistoryDisplay(); // Refresh config history to highlight current config
        
        // Auto-generate command for user to copy
        this.generateCommand();
        
        this.showNotification(`Config "${config.name}" loaded and command generated`, 'success');
    }

    // Edit config
    async editConfig(configId) {
        const config = this.savedConfigs.find(c => c.id === configId);
        if (!config) {
            this.showNotification('Config not found', 'error');
            return;
        }
        
        // Edit config name
        const newName = prompt('Enter new config name:', config.name);
        if (newName && newName.trim() && newName.trim() !== config.name) {
            const trimmedName = newName.trim();
            
            // Check for duplicate names
            if (this.savedConfigs.some(c => c.name === trimmedName && c.id !== configId)) {
                this.showNotification('Config name already exists', 'warning');
                return;
            }
            
            config.name = trimmedName;
            config.updatedAt = new Date().toISOString();
            await this.saveSavedConfigs();
            this.updateConfigHistoryDisplay();
            this.showNotification('Config name updated', 'success');
        }
    }

    // Delete config
    async deleteConfig(configId) {
        const config = this.savedConfigs.find(c => c.id === configId);
        if (!config) return;
        
        // 如果删除的是当前活跃配置，清除活跃状态
        if (this.activeConfig && this.activeConfig.id === configId) {
            this.clearActiveConfig();
        }
        
        if (confirm(`Are you sure you want to delete config "${config.name}"?`)) {
            this.savedConfigs = this.savedConfigs.filter(c => c.id !== configId);
            await this.saveSavedConfigs();
            // Update filtered lists
            this.filteredConfigs = [...this.savedConfigs];
            this.filteredConfigsForModal = [...this.savedConfigs];
            this.updateConfigHistoryDisplay();
            this.showNotification('Config deleted', 'info');
        }
    }

    // ===== 活跃配置管理方法 =====
    
    // 清除活跃配置状态
    clearActiveConfig() {
        this.activeConfig = null;
        this.hasUnsavedChanges = false;
        this.updateActiveConfigIndicator();
        this.updateConfigHistoryDisplay(); // 刷新显示以移除高亮
    }
    
    // 检测配置变更
    detectConfigChanges() {
        if (!this.activeConfig) {
            this.hasUnsavedChanges = false;
            return;
        }
        
        // 比较当前选择和原始配置
        const currentTests = this.selectedTests;
        const originalTests = this.activeConfig.originalTests;
        
        // 简单的数组比较：检查长度和内容
        if (currentTests.length !== originalTests.length) {
            this.hasUnsavedChanges = true;
        } else {
            // 详细比较每个测试项
            this.hasUnsavedChanges = !this.isTestArraysEqual(currentTests, originalTests);
        }
        
        this.updateActiveConfigIndicator();
    }
    
    // 比较两个测试数组是否相等
    isTestArraysEqual(tests1, tests2) {
        if (tests1.length !== tests2.length) return false;
        
        // 创建用于比较的标识符集合
        const set1 = new Set(tests1.map(t => `${t.featureId}-${t.testType}`));
        const set2 = new Set(tests2.map(t => `${t.featureId}-${t.testType}`));
        
        if (set1.size !== set2.size) return false;
        
        for (let item of set1) {
            if (!set2.has(item)) return false;
        }
        
        return true;
    }
    
    // 更新活跃配置指示器
    updateActiveConfigIndicator() {
        const container = document.getElementById('activeConfigIndicator');
        if (!container) return;
        
        if (!this.activeConfig) {
            container.style.display = 'none';
            return;
        }
        
        container.style.display = 'block';
        
        const statusClass = this.hasUnsavedChanges ? 'modified' : 'clean';
        const statusIcon = this.hasUnsavedChanges ? 'fas fa-edit text-warning' : 'fas fa-check-circle text-success';
        const statusText = this.hasUnsavedChanges ? 'Modified' : 'Synced';
        
        container.innerHTML = `
            <div class="active-config-info ${statusClass}">
                <div class="config-status-header">
                    <i class="${statusIcon}"></i>
                    <span class="config-status-text">${statusText}</span>
                    <button class="btn-cancel-edit" onclick="window.testApp.clearActiveConfig()" title="Cancel Edit">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="config-name">Editing: ${this.activeConfig.name}</div>
                ${this.hasUnsavedChanges ? `
                    <div class="config-actions">
                        <button class="btn btn-small btn-primary" onclick="window.testApp.updateActiveConfig()">
                            <i class="fas fa-save"></i> Update Config
                        </button>
                        <button class="btn btn-small btn-secondary" onclick="window.testApp.revertToOriginalConfig()">
                            <i class="fas fa-undo"></i> Revert
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    // 更新当前活跃配置
    async updateActiveConfig() {
        if (!this.activeConfig || !this.hasUnsavedChanges) return;
        
        const config = this.savedConfigs.find(c => c.id === this.activeConfig.id);
        if (!config) {
            this.showNotification('配置不存在', 'error');
            this.clearActiveConfig();
            return;
        }
        
        // 显示修改确认模态框
        this.showModificationModal(config);
    }

    // 显示修改确认模态框
    showModificationModal(config) {
        // 生成变更摘要
        const changeSummary = this.generateChangeSummary(this.activeConfig.originalTests, this.selectedTests);
        
        const modal = document.getElementById('modificationModal') || this.createModificationModal();
        
        // 填充变更摘要
        document.getElementById('changeSummary').innerHTML = changeSummary;
        
        // 清空输入框
        document.getElementById('modificationReason').value = '';
        document.getElementById('modifierName').value = localStorage.getItem('lastModifierName') || '';
        
        // 设置当前配置引用
        this.currentModifyingConfig = config;
        
        modal.style.display = 'flex';
    }

    // 创建修改确认模态框
    createModificationModal() {
        const modalHtml = `
            <div id="modificationModal" class="modal" style="display: none;">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h4><i class="fas fa-edit"></i> 确认配置修改</h4>
                        <button class="close-modal" onclick="window.testApp.closeModificationModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="modification-summary">
                            <h5><i class="fas fa-list-alt"></i> 变更摘要</h5>
                            <div id="changeSummary" class="change-summary-content">
                                <!-- 动态生成的变更内容 -->
                            </div>
                        </div>
                        
                        <div class="modification-form">
                            <div class="form-group">
                                <label for="modificationReason">
                                    <i class="fas fa-comment-alt"></i> 修改原因 <span class="optional-label">(可选)</span>
                                </label>
                                <textarea id="modificationReason" class="form-textarea" rows="3" 
                                    placeholder="请描述修改原因或目的..."></textarea>
                                <small class="form-hint">例如：根据新需求添加smoke测试、移除过期的回归测试等</small>
                            </div>
                            
                            <div class="form-group">
                                <label for="modifierName">
                                    <i class="fas fa-user"></i> 修改人 <span class="optional-label">(可选)</span>
                                </label>
                                <input type="text" id="modifierName" class="form-input" 
                                    placeholder="请输入您的姓名或标识...">
                                <small class="form-hint">系统会记住此信息以便下次自动填充</small>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.testApp.closeModificationModal()">
                            <i class="fas fa-times"></i> 取消
                        </button>
                        <button class="btn btn-primary" onclick="window.testApp.confirmModification()">
                            <i class="fas fa-save"></i> 确认更新
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        return document.getElementById('modificationModal');
    }

    // 生成变更摘要
    generateChangeSummary(originalTests, currentTests) {
        const changes = this.detectDetailedChanges(originalTests, currentTests);
        
        if (changes.added.length === 0 && changes.removed.length === 0) {
            return '<p class="no-changes">未检测到实质性变更</p>';
        }
        
        let html = '<div class="changes-container">';
        
        if (changes.added.length > 0) {
            html += `
                <div class="change-section added">
                    <h6><i class="fas fa-plus-circle text-success"></i> 新增 ${changes.added.length} 个测试标签</h6>
                    <div class="change-items">
                        ${changes.added.map(test => `
                            <span class="change-tag added-tag">
                                <i class="fas fa-tag"></i> ${test.testType}.${test.featureName}
                                <small>(${formatTime(test.time)})</small>
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (changes.removed.length > 0) {
            html += `
                <div class="change-section removed">
                    <h6><i class="fas fa-minus-circle text-danger"></i> 移除 ${changes.removed.length} 个测试标签</h6>
                    <div class="change-items">
                        ${changes.removed.map(test => `
                            <span class="change-tag removed-tag">
                                <i class="fas fa-tag"></i> ${test.testType}.${test.featureName}
                                <small>(${formatTime(test.time)})</small>
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // 添加时间差异统计
        const originalTime = originalTests.reduce((sum, test) => sum + test.time, 0);
        const currentTime = currentTests.reduce((sum, test) => sum + test.time, 0);
        const timeDiff = currentTime - originalTime;
        
        html += `
            <div class="change-summary-stats">
                <div class="time-impact ${timeDiff > 0 ? 'increased' : timeDiff < 0 ? 'decreased' : 'neutral'}">
                    <i class="fas fa-clock"></i> 总时间变化: 
                    ${timeDiff > 0 ? '+' : ''}${formatTime(Math.abs(timeDiff))}
                    ${timeDiff > 0 ? '(增加)' : timeDiff < 0 ? '(减少)' : '(无变化)'}
                </div>
                <div class="count-impact">
                    <i class="fas fa-hashtag"></i> 标签数量: ${originalTests.length} → ${currentTests.length}
                    (${currentTests.length > originalTests.length ? '+' : ''}${currentTests.length - originalTests.length})
                </div>
            </div>
        `;
        
        html += '</div>';
        return html;
    }

    // 检测详细变更
    detectDetailedChanges(originalTests, currentTests) {
        const originalSet = new Map(originalTests.map(t => [`${t.featureId}-${t.testType}`, t]));
        const currentSet = new Map(currentTests.map(t => [`${t.featureId}-${t.testType}`, t]));
        
        const added = [];
        const removed = [];
        
        // 检测新增的测试
        for (const [key, test] of currentSet) {
            if (!originalSet.has(key)) {
                added.push(test);
            }
        }
        
        // 检测移除的测试
        for (const [key, test] of originalSet) {
            if (!currentSet.has(key)) {
                removed.push(test);
            }
        }
        
        return { added, removed };
    }

    // 关闭修改确认模态框
    closeModificationModal() {
        const modal = document.getElementById('modificationModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentModifyingConfig = null;
    }

    // 确认修改
    async confirmModification() {
        if (!this.currentModifyingConfig) return;
        
        const reason = document.getElementById('modificationReason').value.trim();
        const modifier = document.getElementById('modifierName').value.trim();
        
        // 保存修改人信息到localStorage
        if (modifier) {
            localStorage.setItem('lastModifierName', modifier);
        }
        
        await this.performConfigUpdate(this.currentModifyingConfig, reason, modifier);
        this.closeModificationModal();
    }

    // 执行配置更新
    async performConfigUpdate(config, reason, modifier) {
        // 生成修改记录
        const changes = this.detectDetailedChanges(this.activeConfig.originalTests, this.selectedTests);
        const modificationRecord = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            modifier: modifier || 'User',
            reason: reason || '',
            changes: {
                added: changes.added.length,
                removed: changes.removed.length,
                addedItems: changes.added.map(t => ({ testType: t.testType, featureName: t.featureName, time: t.time })),
                removedItems: changes.removed.map(t => ({ testType: t.testType, featureName: t.featureName, time: t.time }))
            },
            beforeCount: this.activeConfig.originalTests.length,
            afterCount: this.selectedTests.length,
            timeDiff: this.selectedTests.reduce((sum, test) => sum + test.time, 0) - 
                     this.activeConfig.originalTests.reduce((sum, test) => sum + test.time, 0)
        };
        
        // 初始化修改历史数组（如果不存在）
        if (!config.modificationHistory) {
            config.modificationHistory = [];
        }
        
        // 添加修改记录
        config.modificationHistory.unshift(modificationRecord); // 最新的记录在前
        
        // 限制历史记录数量（保留最近50次修改）
        if (config.modificationHistory.length > 50) {
            config.modificationHistory = config.modificationHistory.slice(0, 50);
        }
        
        // 更新配置
        config.tests = [...this.selectedTests];
        config.updatedAt = new Date().toISOString();
        config.lastModifier = modifier || 'User';
        config.lastModificationReason = reason || '';
        
        // 更新活跃配置的原始状态
        this.activeConfig.originalTests = JSON.parse(JSON.stringify(this.selectedTests));
        this.hasUnsavedChanges = false;
        
        // 保存到服务器
        await this.saveSavedConfigs();
        
        // 更新显示
        this.updateActiveConfigIndicator();
        this.updateConfigHistoryDisplay();
        this.updateConfigManagementList();
        
        this.showNotification(`Config "${config.name}" updated`, 'success');
    }

    // 显示修改历史
    showModificationHistory(configId) {
        const config = this.savedConfigs.find(c => c.id === configId);
        if (!config || !config.modificationHistory || config.modificationHistory.length === 0) {
            this.showNotification('No modification history found for this config', 'info');
            return;
        }

        const modal = document.getElementById('modificationHistoryModal') || this.createModificationHistoryModal();
        this.populateModificationHistory(config);
        modal.style.display = 'flex';
    }

    // 创建修改历史模态框
    createModificationHistoryModal() {
        const modalHtml = `
            <div id="modificationHistoryModal" class="modal" style="display: none;">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h4><i class="fas fa-history"></i> <span id="historyConfigName">配置修改历史</span></h4>
                        <button class="close-modal" onclick="window.testApp.closeModificationHistoryModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div id="modificationHistoryContent" class="modification-history-content">
                            <!-- 动态生成的历史内容 -->
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.testApp.closeModificationHistoryModal()">
                            <i class="fas fa-times"></i> 关闭
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        return document.getElementById('modificationHistoryModal');
    }

    // 填充修改历史内容
    populateModificationHistory(config) {
        document.getElementById('historyConfigName').textContent = `${config.name} - 修改历史`;
        
        const container = document.getElementById('modificationHistoryContent');
        
        if (!config.modificationHistory || config.modificationHistory.length === 0) {
            container.innerHTML = '<p class="no-history">暂无修改历史记录</p>';
            return;
        }

        let html = '<div class="modification-timeline">';
        
        config.modificationHistory.forEach((record, index) => {
            const isFirst = index === 0;
            const modificationDate = new Date(record.timestamp);
            const timeAgo = this.getTimeAgo(modificationDate);
            
            html += `
                <div class="timeline-item ${isFirst ? 'latest' : ''}">
                    <div class="timeline-marker">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <div class="timeline-title">
                                <i class="fas fa-user"></i> ${record.modifier}
                                ${isFirst ? '<span class="latest-badge">最新</span>' : ''}
                            </div>
                            <div class="timeline-time" title="${modificationDate.toLocaleString()}">
                                ${timeAgo}
                            </div>
                        </div>
                        
                        ${record.reason ? `
                            <div class="timeline-reason">
                                <i class="fas fa-comment-alt"></i> ${record.reason}
                            </div>
                        ` : ''}
                        
                        <div class="timeline-changes">
                            <div class="change-stats">
                                ${record.changes.added > 0 ? `<span class="change-stat added">+${record.changes.added} 新增</span>` : ''}
                                ${record.changes.removed > 0 ? `<span class="change-stat removed">-${record.changes.removed} 移除</span>` : ''}
                                <span class="change-stat total">总计: ${record.beforeCount} → ${record.afterCount}</span>
                                ${record.timeDiff !== 0 ? `
                                    <span class="change-stat time ${record.timeDiff > 0 ? 'increased' : 'decreased'}">
                                        时间: ${record.timeDiff > 0 ? '+' : ''}${formatTime(Math.abs(record.timeDiff))}
                                    </span>
                                ` : ''}
                            </div>
                            
                            ${this.generateTimelineChangeDetails(record)}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }

    // 生成时间线变更详情
    generateTimelineChangeDetails(record) {
        let html = '';
        
        if (record.changes.addedItems && record.changes.addedItems.length > 0) {
            html += `
                <div class="change-details">
                    <h6><i class="fas fa-plus-circle text-success"></i> 新增的测试标签</h6>
                    <div class="change-tags">
                        ${record.changes.addedItems.map(item => `
                            <span class="change-tag added-tag">
                                ${item.testType}.${item.featureName}
                                <small>(${formatTime(item.time)})</small>
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        if (record.changes.removedItems && record.changes.removedItems.length > 0) {
            html += `
                <div class="change-details">
                    <h6><i class="fas fa-minus-circle text-danger"></i> 移除的测试标签</h6>
                    <div class="change-tags">
                        ${record.changes.removedItems.map(item => `
                            <span class="change-tag removed-tag">
                                ${item.testType}.${item.featureName}
                                <small>(${formatTime(item.time)})</small>
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    // 计算相对时间
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) return '刚刚';
        if (diffMin < 60) return `${diffMin}分钟前`;
        if (diffHour < 24) return `${diffHour}小时前`;
        if (diffDay < 7) return `${diffDay}天前`;
        if (diffDay < 30) return `${Math.floor(diffDay / 7)}周前`;
        if (diffDay < 365) return `${Math.floor(diffDay / 30)}个月前`;
        return `${Math.floor(diffDay / 365)}年前`;
    }

    // 关闭修改历史模态框
    closeModificationHistoryModal() {
        const modal = document.getElementById('modificationHistoryModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // 还原到原始配置
    revertToOriginalConfig() {
        if (!this.activeConfig) return;
        
        // 清空当前选择
        this.selectedTests = [];
        
        // 恢复到原始状态
        this.selectedTests = JSON.parse(JSON.stringify(this.activeConfig.originalTests));
        
        // 更新界面radio button状态
        const radioButtons = document.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => radio.checked = false);
        
        this.selectedTests.forEach(test => {
            const radio = document.querySelector(`input[data-feature-id="${test.featureId}"][value="${test.testType}"]`);
            if (radio) {
                radio.checked = true;
            }
        });
        
        // 更新显示
        this.updateDisplay();
        this.generateCommand();
        
        this.showNotification('已还原到原始配置', 'info');
    }

    // 显示管理配置模态框
    showManageConfigModal() {
        const modal = document.getElementById('manageConfigModal');
        // 清空模态框搜索状态
        this.clearConfigModalSearch();
        this.updateConfigManagementList();
        this.bindManageConfigModalEvents();
        modal.style.display = 'flex';
    }

    // 更新配置管理列表
    updateConfigManagementList() {
        const container = document.getElementById('configManagementList');
        if (!container) return;

        // 使用过滤后的配置列表
        const configsToShow = this.filteredConfigsForModal.length > 0 ? this.filteredConfigsForModal : 
                             (this.configModalSearchTerm ? [] : this.savedConfigs);

        if (configsToShow.length === 0) {
            if (this.configModalSearchTerm) {
                container.innerHTML = '<p class="placeholder">No matching configs found</p>';
            } else {
                container.innerHTML = '<p class="placeholder">No saved configs</p>';
            }
            return;
        }

        let html = '';
        configsToShow.forEach(config => {
            const configDate = new Date(config.createdAt).toLocaleDateString();
            const updateDate = new Date(config.updatedAt).toLocaleDateString();
            const totalTests = config.tests.length;
            const totalTime = config.tests.reduce((sum, test) => sum + test.time, 0);
            
            html += `
                <div class="config-management-item">
                    <div class="config-management-info">
                        <h5>${config.name}</h5>
                        <p>${config.description || 'No description'}</p>
                        <p><small>Contains ${totalTests} feature tags · Total time ${formatTime(totalTime)} · Created at ${configDate}</small></p>
                        ${config.createdAt !== config.updatedAt ? `<p><small>Last modified: ${updateDate}</small></p>` : ''}
                    </div>
                    <div class="config-management-actions">
                        <button class="btn btn-small btn-success" onclick="window.testApp.applyConfig('${config.id}')" title="Load this config">
                            <i class="fas fa-download"></i><span> Load</span>
                        </button>
                        <button class="btn btn-small btn-info" onclick="window.testApp.editConfig('${config.id}')" title="Edit config name">
                            <i class="fas fa-edit"></i><span> Edit</span>
                        </button>
                        <button class="btn btn-small btn-secondary" onclick="window.testApp.exportSingleConfig('${config.id}')" title="Export this config">
                            <i class="fas fa-file-export"></i><span> Export</span>
                        </button>
                        <button class="btn btn-small btn-warning" onclick="window.testApp.importSingleConfig('${config.id}')" title="Import and replace this config">
                            <i class="fas fa-file-import"></i><span> Import</span>
                        </button>
                        <button class="btn btn-small btn-danger" onclick="window.testApp.deleteConfig('${config.id}')" title="Delete this config">
                            <i class="fas fa-trash"></i><span> Delete</span>
                        </button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }

    // 绑定管理配置模态框事件
    bindManageConfigModalEvents() {
        const modal = document.getElementById('manageConfigModal');
        const closeBtn = document.getElementById('closeManageModal');
        const closeFooterBtn = document.getElementById('closeManageConfig');
        const exportBtn = document.getElementById('exportConfigs');
        const importBtn = document.getElementById('importConfigs');
        const importNewBtn = document.getElementById('importNewConfig');
        const importFile = document.getElementById('importFile');
        const importSingleFile = document.getElementById('importSingleFile');
        const importNewFile = document.getElementById('importNewFile');
        
        // 移除旧的事件监听器
        const newCloseBtn = closeBtn.cloneNode(true);
        const newCloseFooterBtn = closeFooterBtn.cloneNode(true);
        const newExportBtn = exportBtn.cloneNode(true);
        const newImportBtn = importBtn.cloneNode(true);
        const newImportNewBtn = importNewBtn.cloneNode(true);
        
        closeBtn.replaceWith(newCloseBtn);
        closeFooterBtn.replaceWith(newCloseFooterBtn);
        exportBtn.replaceWith(newExportBtn);
        importBtn.replaceWith(newImportBtn);
        importNewBtn.replaceWith(newImportNewBtn);
        
        // 重新绑定事件
        document.getElementById('closeManageModal').addEventListener('click', () => this.closeManageConfigModal());
        document.getElementById('closeManageConfig').addEventListener('click', () => this.closeManageConfigModal());
        document.getElementById('exportConfigs').addEventListener('click', () => this.exportConfigs());
        document.getElementById('importConfigs').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importNewConfig').addEventListener('click', () => this.importNewConfig());
        
        importFile.addEventListener('change', (e) => this.importConfigs(e));
        importSingleFile.addEventListener('change', (e) => this.handleSingleConfigImport(e));
        importNewFile.addEventListener('change', (e) => this.handleNewConfigImport(e));
        
        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeManageConfigModal();
        });
    }

    // 关闭管理配置模态框
    closeManageConfigModal() {
        document.getElementById('manageConfigModal').style.display = 'none';
    }

    // 导出配置
    exportConfigs() {
        if (this.savedConfigs.length === 0) {
            this.showNotification('No configs to export', 'warning');
            return;
        }
        
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            configs: this.savedConfigs
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test-configs-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Configs exported successfully', 'success');
    }

    // 导出单个配置
    exportSingleConfig(configId) {
        const config = this.savedConfigs.find(c => c.id === configId);
        if (!config) {
            this.showNotification('Config not found', 'error');
            return;
        }
        
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            type: 'single_config',
            config: config
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `config-${config.name.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification(`Config "${config.name}" exported successfully`, 'success');
    }

    // 导入配置
    async importConfigs(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.configs || !Array.isArray(data.configs)) {
                    throw new Error('Invalid config file format');
                }
                
                let importCount = 0;
                data.configs.forEach(config => {
                    // 检查配置是否已存在
                    if (!this.savedConfigs.some(c => c.name === config.name)) {
                        // 生成新的ID以避免冲突
                        config.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
                        config.updatedAt = new Date().toISOString();
                        this.savedConfigs.push(config);
                        importCount++;
                    }
                });
                
                if (importCount > 0) {
                    await this.saveSavedConfigs();
                    // 更新过滤列表
                    this.filteredConfigs = [...this.savedConfigs];
                    this.filteredConfigsForModal = [...this.savedConfigs];
                    this.updateConfigHistoryDisplay();
                    this.updateConfigManagementList();
                    this.showNotification(`Successfully imported ${importCount} configs`, 'success');
                } else {
                    this.showNotification('No new configs to import', 'info');
                }
                
            } catch (error) {
                console.error('Import failed:', error);
                this.showNotification('Import failed: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
        event.target.value = ''; // 清空文件选择
    }

    // 导入单个配置（替换现有配置）
    importSingleConfig(configId) {
        const config = this.savedConfigs.find(c => c.id === configId);
        if (!config) {
            this.showNotification('Config not found', 'error');
            return;
        }
        
        const confirmed = confirm(`This will replace the config "${config.name}" with the imported config. Are you sure?`);
        if (!confirmed) return;
        
        this.pendingImportReplaceId = configId;
        document.getElementById('importSingleFile').click();
    }

    // 处理单个配置文件导入
    async handleSingleConfigImport(event) {
        const file = event.target.files[0];
        if (!file || !this.pendingImportReplaceId) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // 验证文件格式
                let importConfig = null;
                if (data.type === 'single_config' && data.config) {
                    // 单个配置文件格式
                    importConfig = data.config;
                } else if (data.configs && Array.isArray(data.configs) && data.configs.length === 1) {
                    // 包含单个配置的多配置文件格式
                    importConfig = data.configs[0];
                } else if (data.configs && Array.isArray(data.configs) && data.configs.length > 1) {
                    this.showNotification('Multiple configs found. Please select a single config file or use the batch import function.', 'warning');
                    return;
                } else {
                    throw new Error('Invalid single config file format');
                }
                
                // 找到要替换的配置
                const targetIndex = this.savedConfigs.findIndex(c => c.id === this.pendingImportReplaceId);
                if (targetIndex === -1) {
                    throw new Error('Target config not found');
                }
                
                // 保留原有的ID和创建时间，更新其他信息
                const originalConfig = this.savedConfigs[targetIndex];
                importConfig.id = originalConfig.id;
                importConfig.createdAt = originalConfig.createdAt;
                importConfig.updatedAt = new Date().toISOString();
                
                // 替换配置
                this.savedConfigs[targetIndex] = importConfig;
                
                // 如果这是当前活跃配置，清除活跃状态
                if (this.activeConfig && this.activeConfig.id === this.pendingImportReplaceId) {
                    this.clearActiveConfig();
                }
                
                await this.saveSavedConfigs();
                
                // 更新过滤列表
                this.filteredConfigs = [...this.savedConfigs];
                this.filteredConfigsForModal = [...this.savedConfigs];
                this.updateConfigHistoryDisplay();
                this.updateConfigManagementList();
                
                this.showNotification(`Config "${importConfig.name}" imported and replaced successfully`, 'success');
                
            } catch (error) {
                console.error('Single config import failed:', error);
                this.showNotification('Import failed: ' + error.message, 'error');
            } finally {
                this.pendingImportReplaceId = null;
            }
        };
        
        reader.readAsText(file);
        event.target.value = ''; // 清空文件选择
    }

    // 导入新配置
    importNewConfig() {
        document.getElementById('importNewFile').click();
    }

    // 处理导入新配置
    async handleNewConfigImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // 验证文件格式
                let importConfig = null;
                if (data.type === 'single_config' && data.config) {
                    // 单个配置文件格式
                    importConfig = data.config;
                } else if (data.configs && Array.isArray(data.configs) && data.configs.length === 1) {
                    // 包含单个配置的多配置文件格式
                    importConfig = data.configs[0];
                } else if (data.configs && Array.isArray(data.configs) && data.configs.length > 1) {
                    this.showNotification('Multiple configs found. Please select a single config file or use the batch import function.', 'warning');
                    return;
                } else {
                    throw new Error('Invalid config file format');
                }
                
                // 检查配置名称是否已存在，如果存在则生成新名称
                let newName = importConfig.name;
                let counter = 1;
                while (this.savedConfigs.some(c => c.name === newName)) {
                    newName = `${importConfig.name} (${counter})`;
                    counter++;
                }
                
                // 创建新配置
                const newConfig = {
                    ...importConfig,
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    name: newName,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                this.savedConfigs.push(newConfig);
                await this.saveSavedConfigs();
                
                // 更新过滤列表
                this.filteredConfigs = [...this.savedConfigs];
                this.filteredConfigsForModal = [...this.savedConfigs];
                this.updateConfigHistoryDisplay();
                this.updateConfigManagementList();
                
                this.showNotification(`Config imported as "${newConfig.name}"`, 'success');
                
            } catch (error) {
                console.error('New config import failed:', error);
                this.showNotification('Import failed: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
        event.target.value = ''; // 清空文件选择
    }

    // 重写updateDisplay方法以包含配置历史更新
    updateDisplay() {
        this.updateTotalTime();
        this.updateSelectedList();
        this.updateSaveButton(); // 新增：更新保存按钮状态
        this.updateGenerateButton(); // 新增：更新生成按钮状态
        this.updateGroupStats(); // 新增：更新group统计信息
        this.detectConfigChanges(); // 新增：检测配置变更
    }

    // ===== 当前数据持久化功能（服务器版） =====
    
    // 保存当前解析的数据到服务器
    async saveCurrentData() {
        try {
            const dataToSave = {
                ...this.currentData,
                savedAt: new Date().toISOString(),
                appVersion: '1.0'
            };
            await this.serverDataManager.saveCurrentData(dataToSave);
            console.log('✅ 当前数据已保存到服务器');
        } catch (error) {
            console.error('❌ 保存当前数据失败:', error);
            this.showNotification('保存数据失败，已降级到本地存储', 'warning');
        }
    }

    // 清除保存的当前数据
    async clearCurrentData() {
        try {
            await this.serverDataManager.clearCurrentData();
            console.log('🗑️ 已清除服务器上的当前数据');
            this.showNotification('已清除服务器数据', 'info');
        } catch (error) {
            console.error('❌ 清除服务器数据失败:', error);
            this.showNotification('清除服务器数据失败', 'error');
        }
    }

    // 检查是否有保存的数据
    async hasSavedData() {
        try {
            return await this.serverDataManager.hasSavedData();
        } catch (error) {
            console.error('❌ 检查服务器数据失败:', error);
            return false;
        }
    }

    // 获取保存数据的信息
    async getSavedDataInfo() {
        try {
            return await this.serverDataManager.getDataInfo();
        } catch (error) {
            console.error('❌ 获取服务器数据信息失败:', error);
            return null;
        }
    }

    // 确认清除当前数据
    async confirmClearCurrentData() {
        const savedInfo = await this.getSavedDataInfo();
        if (!savedInfo) {
            this.showNotification('当前没有保存的数据', 'info');
            return;
        }

        const confirmMessage = `确定要清除保存的数据吗？\n\n数据来源：${savedInfo.source}\n保存时间：${new Date(savedInfo.savedAt).toLocaleString()}\n功能组数：${savedInfo.groupCount}\n\n清除后将恢复到默认测试数据。`;
        
        if (confirm(confirmMessage)) {
            await this.clearCurrentData();
            this.currentData = testFeatureData;
            this.renderFeatureGroups();
            this.updateDisplay();
            await this.updateDataStatusDisplay(); // 更新数据状态显示
            this.showNotification('已清除保存的数据，恢复到默认数据', 'success');
        }
    }

    // 重置到默认数据
    async resetToDefaultData() {
        const hasCustomData = this.currentData.source !== '本地测试数据';
        
        if (hasCustomData) {
            const confirmMessage = `确定要重置到默认测试数据吗？\n\n当前数据：${this.currentData.source || '未知来源'}\n功能组数：${this.currentData.featureGroups.length}\n\n这将清除所有Excel解析的数据。`;
            
            if (confirm(confirmMessage)) {
                await this.clearCurrentData();
                this.currentData = testFeatureData;
                this.renderFeatureGroups();
                this.updateDisplay();
                await this.updateDataStatusDisplay(); // 更新数据状态显示
                this.showNotification('已重置到默认测试数据', 'success');
            }
        } else {
            this.showNotification('当前已经是默认测试数据', 'info');
        }
    }

    // 显示当前数据详情（增强版）
    async showCurrentDataDetails() {
        const data = this.currentData;
        const savedInfo = await this.getSavedDataInfo();
        
        // 计算统计信息
        const totalFeatures = data.featureGroups.reduce((sum, group) => sum + group.features.length, 0);
        const totalSubFeatures = data.featureGroups.reduce((sum, group) => 
            sum + group.features.reduce((subSum, feature) => 
                subSum + (feature.subFeatures ? feature.subFeatures.length : 0), 0), 0);
        
        let totalTests = 0;
        let totalActiveTests = 0;
        let totalEmptyTests = 0;

        if (data.testLevels) {
            data.featureGroups.forEach(group => {
                group.features.forEach(feature => {
                    Object.keys(feature.tests).forEach(testLevel => {
                        totalTests++;
                        if (feature.tests[testLevel].isEmpty) {
                            totalEmptyTests++;
                        } else {
                            totalActiveTests++;
                        }
                    });
                    
                    if (feature.subFeatures) {
                        feature.subFeatures.forEach(subFeature => {
                            Object.keys(subFeature.tests).forEach(testLevel => {
                                totalTests++;
                                if (subFeature.tests[testLevel].isEmpty) {
                                    totalEmptyTests++;
                                } else {
                                    totalActiveTests++;
                                }
                            });
                        });
                    }
                });
            });
        }

        let statusInfo = '';
        if (savedInfo) {
            statusInfo = `
                <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #2196f3;">
                    <h5 style="color: #1976d2; margin-bottom: 8px;">
                        <i class="fas fa-save"></i> 数据已保存
                    </h5>
                    <div style="font-size: 0.9rem; color: #333;">
                        <strong>保存时间：</strong>${new Date(savedInfo.savedAt).toLocaleString()}<br>
                        <strong>数据来源：</strong>${savedInfo.source}
                    </div>
                </div>
            `;
        } else {
            statusInfo = `
                <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #ff9800;">
                    <h5 style="color: #f57c00; margin-bottom: 8px;">
                        <i class="fas fa-exclamation-triangle"></i> 数据未保存
                    </h5>
                    <div style="font-size: 0.9rem; color: #333;">
                        当前使用的是默认测试数据，刷新页面后不会丢失。
                    </div>
                </div>
            `;
        }

        const detailsHtml = `
            <div style="max-height: 400px; overflow-y: auto;">
                ${statusInfo}
                
                <div style="background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <h4 style="color: #2e7d32; margin-bottom: 10px;">
                        <i class="fas fa-chart-bar"></i> 数据统计
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
                        <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #4caf50;">
                            <div style="font-size: 1.2rem; font-weight: bold; color: #2e7d32;">${data.featureGroups.length}</div>
                            <div style="font-size: 0.8rem; color: #666;">feature group</div>
                        </div>
                        <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #2196f3;">
                            <div style="font-size: 1.2rem; font-weight: bold; color: #1976d2;">${totalFeatures}</div>
                            <div style="font-size: 0.8rem; color: #666;">feature tag</div>
                        </div>
                        <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #ff9800;">
                            <div style="font-size: 1.2rem; font-weight: bold; color: #f57c00;">${totalSubFeatures}</div>
                            <div style="font-size: 0.8rem; color: #666;">sub feature tag</div>
                        </div>
                        ${data.testLevels ? `
                            <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #9c27b0;">
                                <div style="font-size: 1.2rem; font-weight: bold; color: #7b1fa2;">${data.testLevels.length}</div>
                                <div style="font-size: 0.8rem; color: #666;">测试级别</div>
                            </div>
                            <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #4caf50;">
                                <div style="font-size: 1.2rem; font-weight: bold; color: #2e7d32;">${totalActiveTests}</div>
                                <div style="font-size: 0.8rem; color: #666;">活跃测试</div>
                            </div>
                            <div style="text-align: center; background: white; padding: 10px; border-radius: 6px; border-left: 4px solid #9e9e9e;">
                                <div style="font-size: 1.2rem; font-weight: bold; color: #616161;">${totalEmptyTests}</div>
                                <div style="font-size: 0.8rem; color: #666;">空测试</div>
                            </div>
                        ` : ''}
                    </div>
                </div>

                ${data.testLevels && data.testLevels.length > 0 ? `
                    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #2196f3;">
                        <strong>🏷️ 测试级别 (${data.testLevels.length}个):</strong><br>
                        <div style="margin-top: 8px; font-size: 0.9em;">
                            ${data.testLevels.map(level => `<span style="background: white; padding: 3px 8px; border-radius: 12px; margin-right: 8px; display: inline-block; margin-bottom: 4px;">${level}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}

                <div style="background: white; border-radius: 8px; padding: 12px; border-left: 4px solid #607d8b;">
                    <h5 style="color: #455a64; margin-bottom: 8px;">
                        <i class="fas fa-info-circle"></i> 详细信息
                    </h5>
                    <div style="font-size: 0.9rem; color: #333;">
                        <strong>数据来源：</strong>${data.source || '未知'}<br>
                        <strong>最后更新：</strong>${data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '未知'}<br>
                        ${data.savedAt ? `<strong>保存时间：</strong>${new Date(data.savedAt).toLocaleString()}<br>` : ''}
                        <strong>应用版本：</strong>${data.appVersion || 'v1.0'}
                    </div>
                </div>
            </div>
        `;

        // 使用模态框显示详情
        this.showModal('当前数据详情', detailsHtml);
    }

    // 简单的模态框显示方法
    showModal(title, content) {
        // 移除已存在的模态框
        const existingModal = document.getElementById('tempModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 创建临时模态框
        const modal = document.createElement('div');
        modal.id = 'tempModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h4><i class="fas fa-info-circle"></i> ${title}</h4>
                    <button class="close-modal" onclick="document.getElementById('tempModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('tempModal').remove()">
                        <i class="fas fa-times"></i> 关闭
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 点击背景关闭
                 modal.addEventListener('click', (e) => {
             if (e.target === modal) modal.remove();
         });
     }

    // 更新数据状态显示
    async updateDataStatusDisplay() {
        const showCurrentDataBtn = document.getElementById('showCurrentData');
        if (!showCurrentDataBtn) return;

        const savedInfo = await this.getSavedDataInfo();
        const isCustomData = this.currentData.source !== '本地测试数据';
        
        if (savedInfo) {
            // 有保存的数据
            showCurrentDataBtn.innerHTML = `<i class="fas fa-eye"></i> 查看当前数据 <i class="fas fa-check-circle" style="color: #28a745; margin-left: 5px;" title="数据已保存"></i>`;
            showCurrentDataBtn.style.background = '#28a745';
        } else if (isCustomData) {
            // 有自定义数据但未保存
            showCurrentDataBtn.innerHTML = `<i class="fas fa-eye"></i> 查看当前数据 <i class="fas fa-exclamation-triangle" style="color: #ffc107; margin-left: 5px;" title="数据未保存"></i>`;
            showCurrentDataBtn.style.background = '#ffc107';
        } else {
            // 默认数据
            showCurrentDataBtn.innerHTML = `<i class="fas fa-eye"></i> 查看当前数据`;
            showCurrentDataBtn.style.background = '#17a2b8';
        }
    }

    // 计算feature group的统计信息
    calculateGroupStats(group) {
        let totalFeatures = 0;
        let selectedFeatures = 0;
        
        // 计算所有feature（包括sub features）的总数
        group.features.forEach(feature => {
            totalFeatures++; // 主feature
            
            // 检查主feature是否被选择
            if (this.selectedTests.some(test => test.featureId === feature.id)) {
                selectedFeatures++;
            }
            
            // 添加sub features
            if (feature.subFeatures && feature.subFeatures.length > 0) {
                totalFeatures += feature.subFeatures.length;
                
                // 检查sub features是否被选择
                feature.subFeatures.forEach(subFeature => {
                    if (this.selectedTests.some(test => test.featureId === subFeature.id)) {
                        selectedFeatures++;
                    }
                });
            }
        });
        
        return {
            total: totalFeatures,
            selected: selectedFeatures
        };
    }

    // 更新所有group的统计信息显示
    updateGroupStats() {
        const dataToRender = this.filteredData || this.currentData;
        if (!dataToRender?.featureGroups) return;
        
        dataToRender.featureGroups.forEach(group => {
            const stats = this.calculateGroupStats(group);
            const statsElement = document.querySelector(`[data-group-id="${group.id}"] .group-stats`);
            if (statsElement) {
                const isExpanded = this.expandedGroups.has(group.id);
                const statsClass = stats.selected > 0 ? 'has-selection' : '';
                statsElement.innerHTML = `
                    <span class="group-stats-item ${statsClass}">
                        <i class="fas fa-tags"></i>
                        Total: ${stats.total} | Selected: ${stats.selected}
                    </span>
                `;
            }
        });
    }
}

// 格式化时间函数
function formatTime(minutes) {
    // 如果时间为0或空，显示为空
    if (!minutes || minutes === 0) {
        return '';
    }
    
    const totalHours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    // 如果超过24小时，显示天数
    if (totalHours >= 24) {
        const days = Math.floor(totalHours / 24);
        const remainingHours = totalHours % 24;
        
        let result = `${days}D`;
        if (remainingHours > 0) {
            result += `${remainingHours}H`;
        }
        if (mins > 0) {
            result += `${mins}M`;
        }
        return result;
    }
    
    // 小于24小时的情况
    if (totalHours > 0) {
        return `${totalHours}H${mins > 0 ? mins + 'M' : ''}`;
    }
    return `${mins}M`;
}

// 初始化应用
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM加载完成，初始化应用...');
        window.app = new TestSelectorApp();
        window.testSelectorApp = window.app; // 保持兼容性
    });
} else {
    console.log('DOM已加载，立即初始化应用...');
    window.app = new TestSelectorApp();
    window.testSelectorApp = window.app; // 保持兼容性
}