#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
本地API测试脚本
用于验证Python API服务器的所有功能是否正常工作
"""

import requests
import json
import time
import sys

# 测试配置
API_BASE_URL = 'http://localhost:5000/jenkins/109/api'
TEST_DATA = {
    "featureGroups": [
        {
            "id": "test_group_1",
            "name": "测试功能组1",
            "description": "这是一个测试功能组",
            "features": [
                {
                    "id": "test_feature_1",
                    "name": "测试功能1",
                    "owner": "TestUser",
                    "tests": {
                        "ci_night": {"time": 10, "description": "CI测试", "isEmpty": False},
                        "regression": {"time": 20, "description": "回归测试", "isEmpty": False}
                    }
                }
            ]
        }
    ],
    "testLevels": ["ci_night", "regression"],
    "source": "API测试数据",
    "lastUpdated": "2024-01-01T12:00:00.000Z"
}

TEST_CONFIGS = [
    {
        "id": "test_config_1",
        "name": "测试配置1",
        "description": "这是一个测试配置",
        "tests": [
            {
                "featureId": "test_feature_1",
                "featureName": "测试功能1", 
                "testType": "ci_night",
                "time": 10,
                "groupName": "测试功能组1"
            }
        ],
        "createdAt": "2024-01-01T12:00:00.000Z",
        "updatedAt": "2024-01-01T12:00:00.000Z"
    }
]

def print_step(step_name):
    """打印测试步骤"""
    print(f"\n🧪 {step_name}")
    print("=" * 50)

def print_result(success, message):
    """打印测试结果"""
    icon = "✅" if success else "❌"
    print(f"{icon} {message}")
    return success

def test_api_status():
    """测试API状态"""
    print_step("测试API状态")
    try:
        response = requests.get(f"{API_BASE_URL}/status")
        if response.status_code == 200:
            data = response.json()
            print(f"状态: {data.get('status')}")
            print(f"时间戳: {data.get('timestamp')}")
            print(f"数据目录: {data.get('dataDirectory')}")
            return print_result(True, "API状态检查成功")
        else:
            return print_result(False, f"API状态检查失败: HTTP {response.status_code}")
    except Exception as e:
        return print_result(False, f"API状态检查失败: {str(e)}")

def test_save_current_data():
    """测试保存当前数据"""
    print_step("测试保存当前数据")
    try:
        response = requests.post(
            f"{API_BASE_URL}/saveCurrentData",
            json={"data": TEST_DATA},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return print_result(True, "保存当前数据成功")
        else:
            return print_result(False, f"保存当前数据失败: HTTP {response.status_code}")
    except Exception as e:
        return print_result(False, f"保存当前数据失败: {str(e)}")

def test_load_current_data():
    """测试加载当前数据"""
    print_step("测试加载当前数据")
    try:
        response = requests.get(f"{API_BASE_URL}/loadCurrentData")
        if response.status_code == 200:
            data = response.json()
            if data.get('data') and data['data'].get('source') == TEST_DATA['source']:
                return print_result(True, "加载当前数据成功，数据内容正确")
            else:
                return print_result(False, "加载当前数据成功，但数据内容不匹配")
        else:
            return print_result(False, f"加载当前数据失败: HTTP {response.status_code}")
    except Exception as e:
        return print_result(False, f"加载当前数据失败: {str(e)}")

def test_check_data():
    """测试检查数据存在"""
    print_step("测试检查数据存在")
    try:
        response = requests.get(f"{API_BASE_URL}/checkData")
        if response.status_code == 200:
            data = response.json()
            if data.get('exists'):
                return print_result(True, "检查数据存在成功")
            else:
                return print_result(False, "数据不存在")
        else:
            return print_result(False, f"检查数据存在失败: HTTP {response.status_code}")
    except Exception as e:
        return print_result(False, f"检查数据存在失败: {str(e)}")

def test_get_data_info():
    """测试获取数据信息"""
    print_step("测试获取数据信息")
    try:
        response = requests.get(f"{API_BASE_URL}/getDataInfo")
        if response.status_code == 200:
            data = response.json()
            info = data.get('info')
            if info:
                print(f"数据来源: {info.get('source')}")
                print(f"保存时间: {info.get('savedAt')}")
                print(f"功能组数: {info.get('groupCount')}")
                return print_result(True, "获取数据信息成功")
            else:
                return print_result(False, "数据信息为空")
        else:
            return print_result(False, f"获取数据信息失败: HTTP {response.status_code}")
    except Exception as e:
        return print_result(False, f"获取数据信息失败: {str(e)}")

def test_save_configs():
    """测试保存配置"""
    print_step("测试保存配置")
    try:
        response = requests.post(
            f"{API_BASE_URL}/saveConfigs",
            json={"configs": TEST_CONFIGS},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            return print_result(True, "保存配置成功")
        else:
            return print_result(False, f"保存配置失败: HTTP {response.status_code}")
    except Exception as e:
        return print_result(False, f"保存配置失败: {str(e)}")

def test_load_configs():
    """测试加载配置"""
    print_step("测试加载配置")
    try:
        response = requests.get(f"{API_BASE_URL}/loadConfigs")
        if response.status_code == 200:
            data = response.json()
            configs = data.get('configs', [])
            if len(configs) > 0 and configs[0].get('name') == TEST_CONFIGS[0]['name']:
                return print_result(True, f"加载配置成功，配置数量: {len(configs)}")
            else:
                return print_result(False, "加载配置成功，但配置内容不匹配")
        else:
            return print_result(False, f"加载配置失败: HTTP {response.status_code}")
    except Exception as e:
        return print_result(False, f"加载配置失败: {str(e)}")

def test_clear_current_data():
    """测试清除当前数据"""
    print_step("测试清除当前数据")
    try:
        response = requests.delete(f"{API_BASE_URL}/clearCurrentData")
        if response.status_code == 200:
            return print_result(True, "清除当前数据成功")
        else:
            return print_result(False, f"清除当前数据失败: HTTP {response.status_code}")
    except Exception as e:
        return print_result(False, f"清除当前数据失败: {str(e)}")

def test_cors_headers():
    """测试CORS头部"""
    print_step("测试CORS头部")
    try:
        response = requests.options(
            f"{API_BASE_URL}/saveCurrentData",
            headers={
                "Origin": "http://10.91.90.109:8080",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type"
            }
        )
        if response.status_code == 200:
            cors_headers = {
                'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
            }
            print(f"CORS头部: {cors_headers}")
            return print_result(True, "CORS头部测试成功")
        else:
            return print_result(False, f"CORS头部测试失败: HTTP {response.status_code}")
    except Exception as e:
        return print_result(False, f"CORS头部测试失败: {str(e)}")

def main():
    """主测试函数"""
    print("🚀 Python API服务器功能测试")
    print("测试API地址:", API_BASE_URL)
    print("请确保API服务器已启动")
    
    # 等待用户确认
    input("\n按Enter键开始测试...")
    
    # 执行测试
    tests = [
        test_api_status,
        test_cors_headers,
        test_save_current_data,
        test_load_current_data,
        test_check_data,
        test_get_data_info,
        test_save_configs,
        test_load_configs,
        test_clear_current_data
    ]
    
    results = []
    for test_func in tests:
        try:
            result = test_func()
            results.append(result)
            time.sleep(0.5)  # 短暂暂停
        except KeyboardInterrupt:
            print("\n\n⏹️ 测试被用户中断")
            sys.exit(0)
    
    # 总结结果
    print("\n" + "=" * 50)
    print("📊 测试结果总结")
    print("=" * 50)
    
    passed = sum(results)
    total = len(results)
    success_rate = (passed / total) * 100 if total > 0 else 0
    
    print(f"✅ 通过: {passed}/{total} ({success_rate:.1f}%)")
    print(f"❌ 失败: {total - passed}/{total}")
    
    if success_rate == 100:
        print("\n🎉 所有测试通过！API服务器工作正常。")
        return 0
    elif success_rate >= 80:
        print("\n⚠️ 大部分测试通过，但有一些问题需要检查。")
        return 1
    else:
        print("\n💥 多个测试失败，请检查API服务器配置。")
        return 2

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 