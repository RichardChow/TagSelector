// 基于实际Wiki数据的测试功能配置
// 数据来源: https://wiki.rbbn.com/spaces/NPT/pages/1025599886/Automation+Test+Suite+Description+and+Tag
const testFeatureData = {
    featureGroups: [
        {
            id: 'mpls_tp_tunnel_and_service',
            name: 'MPLS-TP Tunnel and Service',
            description: 'MPLS-TP隧道和服务相关测试套件',
            features: [
                {
                    id: 'tp_tunnels',
                    name: 'tp_tunnels',
                    description: '1. Non diff head/tail, transit tunnel, include create, edit cos/BW/port, add/remove cos, tunnel,label delete\n2. Diff head/tail, transit tunnel, include create, edit cos/BW/port, add/remove cos, tunnel,label delete\n3. EXP mapping for head and exp edit,change profile\n4. EXP mapping for transit and exp edit,change profile',
                    suiteDirectory: '024_TP_Tunnels',
                    owner: 'TangYanli',
                    caseQty: 2,
                    tests: {
                        ci_night: {
                            time: 10, // 分钟
                            description: 'TP隧道CI夜间测试'
                        },
                        regression: {
                            time: 20, // 基于ci_night时间估算
                            description: 'TP隧道回归测试'
                        }
                    },
                    subFeatures: [] // 无子功能
                },
                {
                    id: 'l2_service',
                    name: 'l2_service',
                    description: 'L2服务主功能，包含多个子功能测试',
                    suiteDirectory: '025_L2_Service',
                    owner: 'TangYanli',
                    caseQty: 7,
                    remark: 'To be added: MSO LSP1.1+PWR on single ring',
                    tests: {
                        ci_night: {
                            time: 5, // 分钟
                            description: 'L2服务CI夜间测试'
                        },
                        regression: {
                            time: 10, // 基于ci_night时间估算
                            description: 'L2服务回归测试'
                        }
                    },
                    subFeatures: [ // 包含子功能
                        {
                            id: 'l2_service_basic',
                            name: 'basic_l2',
                            description: '1. PB P2P use ENNI,INNI and UNI, edit and delete\n2. MPLS BPDU tunneling VSI with different cos',
                            suiteDirectory: '025_L2_Service/Basic',
                            owner: 'TangYanli',
                            caseQty: 3,
                            tests: {
                                ci_night: {
                                    time: 8,
                                    description: '基础L2服务CI夜间测试'
                                },
                                regression: {
                                    time: 16,
                                    description: '基础L2服务回归测试'
                                }
                            }
                        },
                        {
                            id: 'l2_service_advanced',
                            name: 'advanced_l2',
                            description: '1. MPLS P2P create ,edit tunnel, label and delete\n2. MPLS MP2MP create ,edit tunnel, label and delete\n3. HVPLS, root leaf, and different SHG',
                            suiteDirectory: '025_L2_Service/Advanced',
                            owner: 'TangYanli',
                            caseQty: 4,
                            remark: 'High complexity tests',
                            tests: {
                                ci_night: {
                                    time: 15,
                                    description: '高级L2服务CI夜间测试'
                                },
                                regression: {
                                    time: 30,
                                    description: '高级L2服务回归测试'
                                }
                            }
                        }
                    ]
                },
                {
                    id: 'vfib',
                    name: 'vfib',
                    description: '1. vfib general\n2. static mac\n3. mac move',
                    suiteDirectory: '026_VFIB',
                    owner: 'TangYanli',
                    caseQty: 4,
                    tests: {
                        ci_night: {
                            time: 5, // 分钟
                            description: 'VFIB CI夜间测试'
                        },
                        regression: {
                            time: 10, // 基于ci_night时间估算
                            description: 'VFIB回归测试'
                        }
                    },
                    subFeatures: [] // 无子功能
                }
            ]
        },
        {
            id: 'router_features',
            name: 'Router Features',
            description: '路由器功能相关测试套件',
            features: [
                {
                    id: 'bgp_routing',
                    name: 'bgp_routing',
                    description: 'BGP路由协议测试，包含多个子场景',
                    suiteDirectory: '030_BGP',
                    owner: 'LiMing',
                    caseQty: 10,
                    tests: {
                        ci_night: {
                            time: 20,
                            description: 'BGP路由CI夜间测试'
                        },
                        regression: {
                            time: 40,
                            description: 'BGP路由回归测试'
                        }
                    },
                    subFeatures: [
                        {
                            id: 'bgp_ipv4',
                            name: 'bgp_ipv4',
                            description: 'BGP IPv4单播路由测试',
                            suiteDirectory: '030_BGP/IPv4',
                            owner: 'LiMing',
                            caseQty: 5,
                            tests: {
                                ci_night: {
                                    time: 12,
                                    description: 'BGP IPv4 CI测试'
                                },
                                regression: {
                                    time: 24,
                                    description: 'BGP IPv4回归测试'
                                }
                            }
                        },
                        {
                            id: 'bgp_ipv6',
                            name: 'bgp_ipv6',
                            description: 'BGP IPv6单播路由测试',
                            suiteDirectory: '030_BGP/IPv6',
                            owner: 'LiMing',
                            caseQty: 5,
                            tests: {
                                ci_night: {
                                    time: 15,
                                    description: 'BGP IPv6 CI测试'
                                },
                                regression: {
                                    time: 30,
                                    description: 'BGP IPv6回归测试'
                                }
                            }
                        }
                    ]
                },
                {
                    id: 'ospf_routing',
                    name: 'ospf_routing',
                    description: 'OSPF路由协议基础测试',
                    suiteDirectory: '031_OSPF',
                    owner: 'WangWei',
                    caseQty: 6,
                    tests: {
                        ci_night: {
                            time: 18,
                            description: 'OSPF路由CI夜间测试'
                        },
                        regression: {
                            time: 36,
                            description: 'OSPF路由回归测试'
                        }
                    },
                    subFeatures: [] // 无子功能
                }
            ]
        }
    ],
    source: '本地测试数据',
    lastUpdated: new Date().toISOString()
};

// 从Wiki获取数据的函数
async function fetchWikiData(wikiUrl, credentials = null) {
    try {
        console.log('正在尝试从Wiki获取数据...', wikiUrl);
        
        // 准备请求头
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        };
        
        // 添加身份验证头
        if (credentials && credentials.username && credentials.password) {
            const auth = btoa(`${credentials.username}:${credentials.password}`);
            headers['Authorization'] = `Basic ${auth}`;
            console.log('使用身份验证访问Wiki...');
        }
        
        // 尝试直接访问Wiki页面
        const response = await fetch(wikiUrl, {
            method: 'GET',
            headers: headers,
            mode: 'cors',
            credentials: credentials ? 'include' : 'omit'
        });

        if (response.ok) {
            const htmlContent = await response.text();
            console.log('成功获取Wiki页面，长度:', htmlContent.length);
            
            // 解析HTML内容
            const parsedData = parseWikiTableData(htmlContent);
            
            if (parsedData && parsedData.featureGroups.length > 0) {
                return {
                    success: true,
                    data: parsedData,
                    lastUpdated: new Date().toISOString(),
                    message: `成功从Wiki获取 ${parsedData.featureGroups.length} 个功能组的数据`
                };
            } else {
                console.warn('Wiki页面解析失败，使用本地数据');
                return {
                    success: false,
                    data: testFeatureData,
                    lastUpdated: new Date().toISOString(),
                    message: 'Wiki页面解析失败，使用本地数据'
                };
            }
        } else {
            console.warn('Wiki访问失败，状态码:', response.status);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        console.error('获取Wiki数据失败:', error);
        
        let errorMessage = '获取Wiki数据失败：';
        if (error.message.includes('CORS')) {
            errorMessage += 'CORS跨域限制，请配置代理或在同域环境下访问';
        } else if (error.message.includes('network')) {
            errorMessage += '网络连接问题，请检查网络设置';
        } else if (error.message.includes('HTTP 401') || error.message.includes('HTTP 403')) {
            errorMessage += '需要身份验证，请先登录Wiki系统';
        } else {
            errorMessage += error.message || '未知错误';
        }
        
        return {
            success: false,
            data: testFeatureData, // 返回本地数据作为后备
            lastUpdated: new Date().toISOString(),
            message: errorMessage + '，已使用本地数据'
        };
    }
}

// 解析Wiki HTML表格数据
function parseWikiTableData(htmlContent) {
    try {
        console.log('开始解析Wiki表格数据...');
        
        // 创建一个临时DOM元素来解析HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        // 查找包含测试数据的表格
        const tables = doc.querySelectorAll('table');
        console.log('发现', tables.length, '个表格');
        
        let targetTable = null;
        
        // 查找包含 "Feature Group" 和 "ci_night" 的表格
        for (const table of tables) {
            const tableText = table.textContent.toLowerCase();
            if (tableText.includes('feature group') && tableText.includes('ci_night')) {
                targetTable = table;
                console.log('找到目标表格');
                break;
            }
        }
        
        if (!targetTable) {
            console.warn('未找到包含测试数据的表格');
            return null;
        }
        
        // 解析表格结构
        const rows = targetTable.querySelectorAll('tr');
        if (rows.length < 2) {
            console.warn('表格行数不足');
            return null;
        }
        
        // 解析表头
        const headerRow = rows[0];
        const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => 
            cell.textContent.trim().toLowerCase()
        );
        
        console.log('表头:', headers);
        
        // 查找关键列的索引
        const columnIndexes = {
            featureGroup: findColumnIndex(headers, ['feature group']),
            featureTag: findColumnIndex(headers, ['feature tag']),
            testDescription: findColumnIndex(headers, ['test description']),
            suiteDirectory: findColumnIndex(headers, ['suite directory']),
            owner: findColumnIndex(headers, ['owner']),
            caseQty: findColumnIndex(headers, ['case qty']),
            testTime: findColumnIndex(headers, ['test time', 'test time(m)']),
            remark: findColumnIndex(headers, ['remark'])
        };
        
        console.log('列索引:', columnIndexes);
        
        // 解析数据行
        const featureGroupsMap = new Map();
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = Array.from(row.querySelectorAll('td, th')).map(cell => 
                cell.textContent.trim()
            );
            
            if (cells.length < 3) continue; // 跳过空行或不完整的行
            
            const featureGroupName = cells[columnIndexes.featureGroup] || '';
            const featureTag = cells[columnIndexes.featureTag] || '';
            const testDescription = cells[columnIndexes.testDescription] || '';
            const suiteDirectory = cells[columnIndexes.suiteDirectory] || '';
            const owner = cells[columnIndexes.owner] || '';
            const caseQty = parseInt(cells[columnIndexes.caseQty]) || 0;
            const testTime = parseInt(cells[columnIndexes.testTime]) || 0;
            const remark = cells[columnIndexes.remark] || '';
            
            if (!featureGroupName || !featureTag) continue;
            
            // 获取或创建功能组
            if (!featureGroupsMap.has(featureGroupName)) {
                featureGroupsMap.set(featureGroupName, {
                    id: featureGroupName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                    name: featureGroupName,
                    description: featureGroupName,
                    features: []
                });
            }
            
            const featureGroup = featureGroupsMap.get(featureGroupName);
            
            // 添加功能项
            const feature = {
                id: featureTag,
                name: featureTag,
                description: testDescription,
                suiteDirectory: suiteDirectory,
                owner: owner,
                caseQty: caseQty,
                tests: {
                    ci_night: {
                        time: testTime,
                        description: `CI Night test for ${featureTag}`
                    },
                    regression: {
                        time: Math.max(testTime * 2, testTime + 10), // 估算regression时间
                        description: `Regression test for ${featureTag}`
                    }
                }
            };
            
            if (remark) {
                feature.remark = remark;
            }
            
            featureGroup.features.push(feature);
        }
        
        const result = {
            featureGroups: Array.from(featureGroupsMap.values())
        };
        
        console.log('解析完成，功能组数量:', result.featureGroups.length);
        console.log('解析结果:', result);
        
        return result;
        
    } catch (error) {
        console.error('解析Wiki数据时出错:', error);
        return null;
    }
}

// 查找列索引的辅助函数
function findColumnIndex(headers, searchTerms) {
    for (const term of searchTerms) {
        const index = headers.findIndex(header => header.includes(term));
        if (index !== -1) return index;
    }
    return -1; // 未找到
}

// 时间格式化函数
function formatTime(minutes) {
    if (!minutes || minutes === 0) return '0分钟';
    
    if (minutes < 60) {
        return `${minutes}分钟`;
    } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (remainingMinutes === 0) {
            return `${hours}小时`;
        } else {
            return `${hours}小时${remainingMinutes}分钟`;
        }
    }
}

// 生成RobotFramework命令
function generateRobotCommand(selectedTests) {
    if (!selectedTests || selectedTests.length === 0) return '';
    
    const tags = selectedTests.map(test => `${test.featureName}.${test.testType}`);
    return `- robot --include "${tags.join('" OR "')}" test_suite/`;
}

// 计算总时间
function calculateTotalTime(selectedTests) {
    return selectedTests.reduce((total, test) => total + (test.time || 0), 0);
}

// 验证功能数据结构
function validateFeatureData(data) {
    if (!data || !data.featureGroups || !Array.isArray(data.featureGroups)) {
        throw new Error('无效的数据结构：缺少featureGroups数组');
    }
    
    for (const group of data.featureGroups) {
        if (!group.id || !group.name || !Array.isArray(group.features)) {
            throw new Error(`无效的功能组结构：${group.name || '未知组'}`);
        }
        
        for (const feature of group.features) {
            if (!feature.id || !feature.name || !feature.tests) {
                throw new Error(`无效的功能结构：${feature.name || '未知功能'}`);
            }
            
            if (!feature.tests.ci_night || !feature.tests.regression) {
                throw new Error(`功能缺少必需的测试类型：${feature.name}`);
            }
            
            // 验证子功能结构（如果存在）
            if (feature.subFeatures) {
                if (!Array.isArray(feature.subFeatures)) {
                    throw new Error(`无效的子功能结构：${feature.name}`);
                }
                
                for (const subFeature of feature.subFeatures) {
                    if (!subFeature.id || !subFeature.name || !subFeature.tests) {
                        throw new Error(`无效的子功能结构：${subFeature.name || '未知子功能'}`);
                    }
                    
                    if (!subFeature.tests.ci_night || !subFeature.tests.regression) {
                        throw new Error(`子功能缺少必需的测试类型：${subFeature.name}`);
                    }
                }
            }
        }
    }
    
    return true;
}

// 数据统计函数
function getDataStatistics(data) {
    if (!validateFeatureData(data)) return null;
    
    let totalFeatures = 0;
    let totalSubFeatures = 0;
    let totalCiTime = 0;
    let totalRegressionTime = 0;
    
    for (const group of data.featureGroups) {
        totalFeatures += group.features.length;
        
        for (const feature of group.features) {
            totalCiTime += feature.tests.ci_night.time || 0;
            totalRegressionTime += feature.tests.regression.time || 0;
            
            if (feature.subFeatures) {
                totalSubFeatures += feature.subFeatures.length;
                
                for (const subFeature of feature.subFeatures) {
                    totalCiTime += subFeature.tests.ci_night.time || 0;
                    totalRegressionTime += subFeature.tests.regression.time || 0;
                }
            }
        }
    }
    
    return {
        totalGroups: data.featureGroups.length,
        totalFeatures,
        totalSubFeatures,
        totalCiTime,
        totalRegressionTime,
        hasMultiLevel: totalSubFeatures > 0
    };
}

// 创建示例Excel数据（用于测试）
function createSampleExcelData() {
    return [
        ['Feature Group', 'Feature Tag', 'Sub Feature Tag', 'Test Description', 'Suite Directory', 'Owner', 'test_Qty', 'test_time', 'confidence', 'remark'],
        ['MPLS-TP Tunnel and Service', 'tp_tunnels', '', 'TP隧道基础测试', '024_TP_Tunnels', 'TangYanli', '2', '10', 'high', ''],
        ['MPLS-TP Tunnel and Service', 'l2_service', 'basic_l2', 'L2基础服务测试', '025_L2_Service/Basic', 'TangYanli', '3', '8', 'medium', ''],
        ['MPLS-TP Tunnel and Service', 'l2_service', 'advanced_l2', 'L2高级服务测试', '025_L2_Service/Advanced', 'TangYanli', '4', '15', 'high', 'High complexity tests'],
        ['MPLS-TP Tunnel and Service', 'vfib', '', 'VFIB相关测试', '026_VFIB', 'TangYanli', '4', '5', 'high', ''],
        ['Router Features', 'bgp_routing', 'bgp_ipv4', 'BGP IPv4单播路由测试', '030_BGP/IPv4', 'LiMing', '5', '12', 'high', ''],
        ['Router Features', 'bgp_routing', 'bgp_ipv6', 'BGP IPv6单播路由测试', '030_BGP/IPv6', 'LiMing', '5', '15', 'high', ''],
        ['Router Features', 'ospf_routing', '', 'OSPF路由协议测试', '031_OSPF', 'WangWei', '6', '18', 'medium', '']
    ];
}

// 检查数据是否包含多层级结构
function hasMultiLevelStructure(data) {
    if (!data || !data.featureGroups) return false;
    
    return data.featureGroups.some(group => 
        group.features.some(feature => 
            feature.subFeatures && feature.subFeatures.length > 0
        )
    );
}

// 获取所有功能（包括子功能）的平坦列表
function getFlatFeatureList(data) {
    if (!data || !data.featureGroups) return [];
    
    const flatList = [];
    
    for (const group of data.featureGroups) {
        for (const feature of group.features) {
            flatList.push({
                ...feature,
                groupName: group.name,
                groupId: group.id,
                isSubFeature: false
            });
            
            if (feature.subFeatures) {
                for (const subFeature of feature.subFeatures) {
                    flatList.push({
                        ...subFeature,
                        groupName: group.name,
                        groupId: group.id,
                        parentFeatureName: feature.name,
                        parentFeatureId: feature.id,
                        isSubFeature: true
                    });
                }
            }
        }
    }
    
    return flatList;
}

console.log('🚀 Data.js已加载，支持Excel解析和多层级Sub Feature Tag功能');
console.log('📊 测试数据统计:', getDataStatistics(testFeatureData));

// 导出数据和工具函数
window.testFeatureData = testFeatureData;
window.fetchWikiData = fetchWikiData;
window.formatTime = formatTime;
window.generateRobotCommand = generateRobotCommand;
window.calculateTotalTime = calculateTotalTime;
window.validateFeatureData = validateFeatureData; 