package server;

import config.Config;
import models.Message;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import utils.JsonUtil;
import utils.Version;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * WebSocket 服务器
 */
public class LocalWebSocketServer extends WebSocketServer {
    private final Config config;
    private final Map<WebSocket, String> connections;
    private final ScheduledExecutorService heartbeatExecutor;

    public LocalWebSocketServer(Config config) {
        super(new InetSocketAddress(
            config.client().bindAddress(), 
            config.client().wsPort()
        ));
        
        this.config = config;
        this.connections = new ConcurrentHashMap<>();
        this.heartbeatExecutor = Executors.newSingleThreadScheduledExecutor();
        
        // 使用虚拟线程
        setReuseAddr(true);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        String clientId = conn.getRemoteSocketAddress().toString();
        connections.put(conn, clientId);
        
        System.out.println("WebSocket connection opened: " + clientId);
        
        // 发送欢迎消息
        Message welcome = Message.event("connected", Map.of(
            "message", "Connected to Localverse",
            "version", Version.VERSION
        ));
        
        conn.send(JsonUtil.toJson(welcome));
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        String clientId = connections.remove(conn);
        System.out.println("WebSocket connection closed: " + clientId + 
                          " (code: " + code + ", reason: " + reason + ")");
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            Message msg = JsonUtil.fromJson(message, Message.class);
            handleMessage(conn, msg);
        } catch (Exception e) {
            System.err.println("Error parsing message: " + e.getMessage());
            sendError(conn, "Invalid message format");
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.err.println("WebSocket error: " + ex.getMessage());
        ex.printStackTrace();
    }

    @Override
    public void onStart() {
        System.out.println("WebSocket Server started on " + 
                          config.client().bindAddress() + ":" + 
                          config.client().wsPort());
        
        // 启动心跳
        startHeartbeat();
    }

    /**
     * 处理消息
     */
    private void handleMessage(WebSocket conn, Message msg) {
        String type = msg.type();
        String action = msg.action();

        switch (type) {
            case "heartbeat" -> handleHeartbeat(conn, msg);
            case "auth" -> handleAuth(conn, msg);
            case "subscribe" -> handleSubscribe(conn, msg);
            case "message" -> handleUserMessage(conn, msg);
            default -> System.out.println("Unknown message type: " + type);
        }
    }

    /**
     * 处理心跳
     */
    private void handleHeartbeat(WebSocket conn, Message msg) {
        // 响应心跳
        Message pong = Message.create("heartbeat", "pong", Map.of(
            "timestamp", System.currentTimeMillis()
        ));
        conn.send(JsonUtil.toJson(pong));
    }

    /**
     * 处理认证
     */
    private void handleAuth(WebSocket conn, Message msg) {
        // 简单认证（实际应该验证 token）
        Message response = Message.ack("auth", Map.of(
            "success", true,
            "userId", config.user().id(),
            "userName", config.user().name()
        ));
        conn.send(JsonUtil.toJson(response));
    }

    /**
     * 处理订阅
     */
    private void handleSubscribe(WebSocket conn, Message msg) {
        String channel = (String) msg.payload().get("channel");
        
        Message response = Message.ack("subscribe", Map.of(
            "success", true,
            "channel", channel
        ));
        conn.send(JsonUtil.toJson(response));
    }

    /**
     * 处理用户消息
     */
    private void handleUserMessage(WebSocket conn, Message msg) {
        // 回显消息（实际应该处理业务逻辑）
        Message response = Message.ack("message", Map.of(
            "received", true,
            "messageId", msg.id()
        ));
        conn.send(JsonUtil.toJson(response));
    }

    /**
     * 发送错误消息
     */
    private void sendError(WebSocket conn, String error) {
        Message msg = Message.create("error", "error", Map.of(
            "message", error
        ));
        conn.send(JsonUtil.toJson(msg));
    }

    /**
     * 广播消息到所有连接
     */
    public void broadcast(Message message) {
        String json = JsonUtil.toJson(message);
        for (WebSocket conn : connections.keySet()) {
            conn.send(json);
        }
    }

    /**
     * 启动心跳
     */
    private void startHeartbeat() {
        heartbeatExecutor.scheduleAtFixedRate(() -> {
            Message heartbeat = Message.heartbeat();
            String json = JsonUtil.toJson(heartbeat);
            
            for (WebSocket conn : connections.keySet()) {
                if (conn.isOpen()) {
                    conn.send(json);
                }
            }
        }, 30, 30, TimeUnit.SECONDS);
    }

    /**
     * 停止服务器
     */
    public void shutdown() {
        try {
            heartbeatExecutor.shutdown();
            stop(1000);
            System.out.println("WebSocket Server stopped");
        } catch (Exception e) {
            System.err.println("Error stopping WebSocket server: " + e.getMessage());
        }
    }
}
