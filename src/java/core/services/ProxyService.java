package services;

import config.Config;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * Proxy service for forwarding requests to Sync Server
 */
public class ProxyService {
    private final Config.SyncServerConfig config;
    private final HttpClient httpClient;

    public ProxyService(Config.SyncServerConfig config) {
        this.config = config;
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(config.timeout()))
            .build();
    }

    /**
     * Forward GET request to sync server
     */
    public ProxyResponse forwardGet(String path, Map<String, String> headers) throws IOException, InterruptedException {
        if (!config.enabled()) {
            throw new IOException("Sync server is disabled");
        }

        String url = config.url() + path;
        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .GET()
            .timeout(Duration.ofMillis(config.timeout()));

        // Add headers
        if (headers != null) {
            headers.forEach(builder::header);
        }

        HttpRequest request = builder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        return new ProxyResponse(response.statusCode(), response.body(), response.headers().map());
    }

    /**
     * Forward POST request to sync server
     */
    public ProxyResponse forwardPost(String path, String body, Map<String, String> headers) throws IOException, InterruptedException {
        if (!config.enabled()) {
            throw new IOException("Sync server is disabled");
        }

        String url = config.url() + path;
        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .timeout(Duration.ofMillis(config.timeout()));

        // Add headers
        if (headers != null) {
            headers.forEach(builder::header);
        }

        HttpRequest request = builder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        return new ProxyResponse(response.statusCode(), response.body(), response.headers().map());
    }

    /**
     * Forward PUT request to sync server
     */
    public ProxyResponse forwardPut(String path, String body, Map<String, String> headers) throws IOException, InterruptedException {
        if (!config.enabled()) {
            throw new IOException("Sync server is disabled");
        }

        String url = config.url() + path;
        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .PUT(HttpRequest.BodyPublishers.ofString(body))
            .timeout(Duration.ofMillis(config.timeout()));

        // Add headers
        if (headers != null) {
            headers.forEach(builder::header);
        }

        HttpRequest request = builder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        return new ProxyResponse(response.statusCode(), response.body(), response.headers().map());
    }

    /**
     * Forward DELETE request to sync server
     */
    public ProxyResponse forwardDelete(String path, Map<String, String> headers) throws IOException, InterruptedException {
        if (!config.enabled()) {
            throw new IOException("Sync server is disabled");
        }

        String url = config.url() + path;
        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create(url))
            .DELETE()
            .timeout(Duration.ofMillis(config.timeout()));

        // Add headers
        if (headers != null) {
            headers.forEach(builder::header);
        }

        HttpRequest request = builder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        return new ProxyResponse(response.statusCode(), response.body(), response.headers().map());
    }

    /**
     * Check if sync server is available
     */
    public boolean isAvailable() {
        if (!config.enabled()) {
            return false;
        }

        try {
            String url = config.url() + "/api/health";
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .timeout(Duration.ofSeconds(5))
                .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    public record ProxyResponse(int statusCode, String body, Map<String, java.util.List<String>> headers) {}
}
