package services;

import config.Config;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 代理服务 - 转发请求到 Sync Server
 */
public class ProxyService {
    private final Config config;
    private final HttpClient httpClient;
    private final String syncServerUrl;

    public ProxyService(Config config) {
        this.config = config;
        this.syncServerUrl = config.client().syncServer();
        
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /**
     * 代理请求响应
     */
    public record ProxyResponse(
        int statusCode,
        Map<String, List<String>> headers,
        byte[] body
    ) {}

    /**
     * 转发 GET 请求
     */
    public ProxyResponse forwardGet(String path, Map<String, String> headers) throws IOException {
        String url = buildUrl(path);
        
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .GET();

        addHeaders(requestBuilder, headers);

        try {
            HttpRequest request = requestBuilder.build();
            HttpResponse<byte[]> response = httpClient.send(request, 
                    HttpResponse.BodyHandlers.ofByteArray());
            
            return new ProxyResponse(
                response.statusCode(),
                response.headers().map(),
                response.body()
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Request interrupted", e);
        } catch (Exception e) {
            throw new IOException("Proxy request failed: " + e.getMessage(), e);
        }
    }

    /**
     * 转发 POST 请求
     */
    public ProxyResponse forwardPost(String path, Map<String, String> headers, byte[] body) 
            throws IOException {
        String url = buildUrl(path);
        
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body));

        addHeaders(requestBuilder, headers);

        try {
            HttpRequest request = requestBuilder.build();
            HttpResponse<byte[]> response = httpClient.send(request, 
                    HttpResponse.BodyHandlers.ofByteArray());
            
            return new ProxyResponse(
                response.statusCode(),
                response.headers().map(),
                response.body()
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Request interrupted", e);
        } catch (Exception e) {
            throw new IOException("Proxy request failed: " + e.getMessage(), e);
        }
    }

    /**
     * 转发 PUT 请求
     */
    public ProxyResponse forwardPut(String path, Map<String, String> headers, byte[] body) 
            throws IOException {
        String url = buildUrl(path);
        
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .PUT(HttpRequest.BodyPublishers.ofByteArray(body));

        addHeaders(requestBuilder, headers);

        try {
            HttpRequest request = requestBuilder.build();
            HttpResponse<byte[]> response = httpClient.send(request, 
                    HttpResponse.BodyHandlers.ofByteArray());
            
            return new ProxyResponse(
                response.statusCode(),
                response.headers().map(),
                response.body()
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Request interrupted", e);
        } catch (Exception e) {
            throw new IOException("Proxy request failed: " + e.getMessage(), e);
        }
    }

    /**
     * 转发 DELETE 请求
     */
    public ProxyResponse forwardDelete(String path, Map<String, String> headers) 
            throws IOException {
        String url = buildUrl(path);
        
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(30))
                .DELETE();

        addHeaders(requestBuilder, headers);

        try {
            HttpRequest request = requestBuilder.build();
            HttpResponse<byte[]> response = httpClient.send(request, 
                    HttpResponse.BodyHandlers.ofByteArray());
            
            return new ProxyResponse(
                response.statusCode(),
                response.headers().map(),
                response.body()
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Request interrupted", e);
        } catch (Exception e) {
            throw new IOException("Proxy request failed: " + e.getMessage(), e);
        }
    }

    /**
     * 构建完整 URL
     */
    private String buildUrl(String path) {
        // 移除 /api/sync 前缀
        String targetPath = path;
        if (targetPath.startsWith("/api/sync")) {
            targetPath = targetPath.substring("/api/sync".length());
        }
        
        // 确保以 /api 开头
        if (!targetPath.startsWith("/api")) {
            targetPath = "/api" + targetPath;
        }

        return syncServerUrl + targetPath;
    }

    /**
     * 添加请求头
     */
    private void addHeaders(HttpRequest.Builder builder, Map<String, String> headers) {
        if (headers != null) {
            headers.forEach(builder::header);
        }
    }

    /**
     * 检查 Sync Server 是否可用
     */
    public boolean isAvailable() {
        try {
            String url = syncServerUrl + "/api/health";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, 
                    HttpResponse.BodyHandlers.ofString());
            
            return response.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }
}
