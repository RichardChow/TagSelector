package com.jenkins.api;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.servlet.*;
import javax.servlet.http.*;
import javax.servlet.annotation.WebServlet;
import com.google.gson.*;
import com.google.gson.reflect.TypeToken;

@WebServlet("/api/*")
public class DataAPIServlet extends HttpServlet {

    private static final String DATA_DIR = "/home/enm/jenkins_data/"; // 数据存储目录
    private static final String CURRENT_DATA_FILE = "current_data_%s.json";
    private static final String CONFIGS_FILE = "configs_%s.json";
    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    @Override
    public void init() throws ServletException {
        super.init();
        // 确保数据目录存在
        try {
            Files.createDirectories(Paths.get(DATA_DIR));
            System.out.println("✅ 数据目录初始化成功: " + DATA_DIR);
        } catch (IOException e) {
            System.err.println("❌ 数据目录初始化失败: " + e.getMessage());
            throw new ServletException("无法创建数据目录", e);
        }
    }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        String pathInfo = request.getPathInfo();
        String userId = request.getParameter("userId");

        if (userId == null || userId.trim().isEmpty()) {
            sendError(response, 400, "缺少userId参数");
            return;
        }

        try {
            switch (pathInfo) {
                case "/loadCurrentData":
                    handleLoadCurrentData(request, response, userId);
                    break;
                case "/loadConfigs":
                    handleLoadConfigs(request, response, userId);
                    break;
                case "/checkData":
                    handleCheckData(request, response, userId);
                    break;
                case "/getDataInfo":
                    handleGetDataInfo(request, response, userId);
                    break;
                default:
                    sendError(response, 404, "API接口不存在");
            }
        } catch (Exception e) {
            System.err.println("❌ API处理异常: " + e.getMessage());
            e.printStackTrace();
            sendError(response, 500, "服务器内部错误: " + e.getMessage());
        }
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        String pathInfo = request.getPathInfo();

        // 读取请求体
        StringBuilder requestBody = new StringBuilder();
        try (BufferedReader reader = request.getReader()) {
            String line;
            while ((line = reader.readLine()) != null) {
                requestBody.append(line);
            }
        }

        Map<String, Object> requestData = gson.fromJson(requestBody.toString(),
                new TypeToken<Map<String, Object>>() {
                }.getType());

        String userId = (String) requestData.get("userId");

        if (userId == null || userId.trim().isEmpty()) {
            sendError(response, 400, "缺少userId参数");
            return;
        }

        try {
            switch (pathInfo) {
                case "/saveCurrentData":
                    handleSaveCurrentData(request, response, requestData, userId);
                    break;
                case "/saveConfigs":
                    handleSaveConfigs(request, response, requestData, userId);
                    break;
                default:
                    sendError(response, 404, "API接口不存在");
            }
        } catch (Exception e) {
            System.err.println("❌ API处理异常: " + e.getMessage());
            e.printStackTrace();
            sendError(response, 500, "服务器内部错误: " + e.getMessage());
        }
    }

    @Override
    protected void doDelete(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");

        String pathInfo = request.getPathInfo();

        // 读取请求体
        StringBuilder requestBody = new StringBuilder();
        try (BufferedReader reader = request.getReader()) {
            String line;
            while ((line = reader.readLine()) != null) {
                requestBody.append(line);
            }
        }

        Map<String, Object> requestData = gson.fromJson(requestBody.toString(),
                new TypeToken<Map<String, Object>>() {
                }.getType());

        String userId = (String) requestData.get("userId");

        if (userId == null || userId.trim().isEmpty()) {
            sendError(response, 400, "缺少userId参数");
            return;
        }

        try {
            switch (pathInfo) {
                case "/clearCurrentData":
                    handleClearCurrentData(request, response, userId);
                    break;
                default:
                    sendError(response, 404, "API接口不存在");
            }
        } catch (Exception e) {
            System.err.println("❌ API处理异常: " + e.getMessage());
            e.printStackTrace();
            sendError(response, 500, "服务器内部错误: " + e.getMessage());
        }
    }

    @Override
    protected void doOptions(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type");
        response.setStatus(HttpServletResponse.SC_OK);
    }

    // ===== 处理方法 =====

    private void handleSaveCurrentData(HttpServletRequest request, HttpServletResponse response,
            Map<String, Object> requestData, String userId) throws IOException {

        Object data = requestData.get("data");
        if (data == null) {
            sendError(response, 400, "缺少data参数");
            return;
        }

        String fileName = String.format(CURRENT_DATA_FILE, sanitizeUserId(userId));
        Path filePath = Paths.get(DATA_DIR, fileName);

        // 创建数据包装
        Map<String, Object> dataWrapper = new HashMap<>();
        dataWrapper.put("userId", userId);
        dataWrapper.put("data", data);
        dataWrapper.put("savedAt", new Date().toString());
        dataWrapper.put("serverVersion", "1.0");

        Files.write(filePath, gson.toJson(dataWrapper).getBytes());

        System.out.println("✅ 保存用户数据: " + userId + " -> " + fileName);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("success", true);
        responseData.put("message", "数据保存成功");
        responseData.put("savedAt", dataWrapper.get("savedAt"));

        sendResponse(response, responseData);
    }

    private void handleLoadCurrentData(HttpServletRequest request, HttpServletResponse response,
            String userId) throws IOException {

        String fileName = String.format(CURRENT_DATA_FILE, sanitizeUserId(userId));
        Path filePath = Paths.get(DATA_DIR, fileName);

        if (!Files.exists(filePath)) {
            response.setStatus(404);
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("error", "数据不存在");
            sendResponse(response, responseData);
            return;
        }

        String content = new String(Files.readAllBytes(filePath));
        Map<String, Object> dataWrapper = gson.fromJson(content,
                new TypeToken<Map<String, Object>>() {
                }.getType());

        System.out.println("✅ 加载用户数据: " + userId + " <- " + fileName);

        sendResponse(response, dataWrapper);
    }

    private void handleClearCurrentData(HttpServletRequest request, HttpServletResponse response,
            String userId) throws IOException {

        String fileName = String.format(CURRENT_DATA_FILE, sanitizeUserId(userId));
        Path filePath = Paths.get(DATA_DIR, fileName);

        if (Files.exists(filePath)) {
            Files.delete(filePath);
            System.out.println("✅ 清除用户数据: " + userId + " -> " + fileName);
        }

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("success", true);
        responseData.put("message", "数据清除成功");

        sendResponse(response, responseData);
    }

    private void handleCheckData(HttpServletRequest request, HttpServletResponse response,
            String userId) throws IOException {

        String fileName = String.format(CURRENT_DATA_FILE, sanitizeUserId(userId));
        Path filePath = Paths.get(DATA_DIR, fileName);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("exists", Files.exists(filePath));
        responseData.put("userId", userId);

        sendResponse(response, responseData);
    }

    private void handleGetDataInfo(HttpServletRequest request, HttpServletResponse response,
            String userId) throws IOException {

        String fileName = String.format(CURRENT_DATA_FILE, sanitizeUserId(userId));
        Path filePath = Paths.get(DATA_DIR, fileName);

        if (!Files.exists(filePath)) {
            response.setStatus(404);
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("error", "数据不存在");
            sendResponse(response, responseData);
            return;
        }

        String content = new String(Files.readAllBytes(filePath));
        Map<String, Object> dataWrapper = gson.fromJson(content,
                new TypeToken<Map<String, Object>>() {
                }.getType());

        Map<String, Object> dataObject = (Map<String, Object>) dataWrapper.get("data");

        Map<String, Object> info = new HashMap<>();
        info.put("source", dataObject.get("source"));
        info.put("savedAt", dataWrapper.get("savedAt"));
        info.put("groupCount", getGroupCount(dataObject));
        info.put("userId", userId);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("info", info);

        sendResponse(response, responseData);
    }

    private void handleSaveConfigs(HttpServletRequest request, HttpServletResponse response,
            Map<String, Object> requestData, String userId) throws IOException {

        Object configs = requestData.get("configs");
        if (configs == null) {
            sendError(response, 400, "缺少configs参数");
            return;
        }

        String fileName = String.format(CONFIGS_FILE, sanitizeUserId(userId));
        Path filePath = Paths.get(DATA_DIR, fileName);

        Map<String, Object> configWrapper = new HashMap<>();
        configWrapper.put("userId", userId);
        configWrapper.put("configs", configs);
        configWrapper.put("savedAt", new Date().toString());
        configWrapper.put("serverVersion", "1.0");

        Files.write(filePath, gson.toJson(configWrapper).getBytes());

        System.out.println("✅ 保存用户配置: " + userId + " -> " + fileName);

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("success", true);
        responseData.put("message", "配置保存成功");

        sendResponse(response, responseData);
    }

    private void handleLoadConfigs(HttpServletRequest request, HttpServletResponse response,
            String userId) throws IOException {

        String fileName = String.format(CONFIGS_FILE, sanitizeUserId(userId));
        Path filePath = Paths.get(DATA_DIR, fileName);

        if (!Files.exists(filePath)) {
            Map<String, Object> responseData = new HashMap<>();
            responseData.put("configs", new ArrayList<>());
            sendResponse(response, responseData);
            return;
        }

        String content = new String(Files.readAllBytes(filePath));
        Map<String, Object> configWrapper = gson.fromJson(content,
                new TypeToken<Map<String, Object>>() {
                }.getType());

        System.out.println("✅ 加载用户配置: " + userId + " <- " + fileName);

        sendResponse(response, configWrapper);
    }

    // ===== 工具方法 =====

    private String sanitizeUserId(String userId) {
        // 清理用户ID，只保留字母、数字和下划线
        return userId.replaceAll("[^a-zA-Z0-9_]", "_");
    }

    private int getGroupCount(Map<String, Object> dataObject) {
        try {
            List<Object> featureGroups = (List<Object>) dataObject.get("featureGroups");
            return featureGroups != null ? featureGroups.size() : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private void sendResponse(HttpServletResponse response, Object data) throws IOException {
        PrintWriter out = response.getWriter();
        out.print(gson.toJson(data));
        out.flush();
    }

    private void sendError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        Map<String, Object> error = new HashMap<>();
        error.put("error", message);
        error.put("status", status);
        sendResponse(response, error);
    }
}