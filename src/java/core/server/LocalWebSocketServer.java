package server;

import config.Config;
import models.Message;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;
import utils.JsonUtil;

import java.net.InetSocketAddress;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Local WebSocket Server
 * Provides real-time bidirectional communication
 */
public class LocalWebSocketServer extends WebSocketServer {
    private final Config config;
    private final Map<WebSocket, String> connections = new ConcurrentHashMap<>();
    private final Map<String, Map<WebSocket, Boolean>> channels = new ConcurrentHashMap<>();

    public LocalWebSocketServer(Config config) {
        super(createAddress(config));
        this.config = config;
        setReuseAddr(true);
    }

    private static InetSocketAddress createAddress(Config config) {
        int port = "client".equals(config.mode()) ? 
            config.client().wsPort() : config.server().wsPort();
        String bindAddress = "client".equals(config.mode()) ? 
            config.client().bindAddress() : config.server().bindAddress();
        return new InetSocketAddress(bindAddress, port);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        String sessionId = java.util.UUID.randomUUID().toString();
        connections.put(conn, sessionId);
        System.out.println("✓ WebSocket connection opened: " + sessionId);

        // Send welcome message
        Message welcome = Message.event("connected", Map.of("sessionId", sessionId));
        conn.send(JsonUtil.toJson(welcome));
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        String sessionId = connections.remove(conn);
        
        // Remove from all channels
        channels.values().forEach(subscribers -> subscribers.remove(conn));
        
        System.out.println("✓ WebSocket connection closed: " + sessionId);
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        try {
            Message msg = JsonUtil.fromJson(message, Message.class);
            handleMessage(conn, msg);
        } catch (Exception e) {
            System.err.println("⚠ Error processing message: " + e.getMessage());
            Message error = Message.error("parse_error", "Invalid message format");
            conn.send(JsonUtil.toJson(error));
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        String sessionId = conn != null ? connections.get(conn) : "unknown";
        System.err.println("⚠ WebSocket error on connection " + sessionId + ": " + ex.getMessage());
    }

    @Override
    public void onStart() {
        int port = "client".equals(config.mode()) ? 
            config.client().wsPort() : config.server().wsPort();
        String bindAddress = "client".equals(config.mode()) ? 
            config.client().bindAddress() : config.server().bindAddress();
        System.out.println("✓ WebSocket Server started on " + bindAddress + ":" + port);
    }

    private void handleMessage(WebSocket conn, Message msg) {
        switch (msg.type()) {
            case "auth" -> handleAuth(conn, msg);
            case "subscribe" -> handleSubscribe(conn, msg);
            case "unsubscribe" -> handleUnsubscribe(conn, msg);
            case "message" -> handleUserMessage(conn, msg);
            case "heartbeat" -> handleHeartbeat(conn, msg);
            default -> {
                Message error = Message.error("unknown_type", "Unknown message type: " + msg.type());
                conn.send(JsonUtil.toJson(error));
            }
        }
    }

    private void handleAuth(WebSocket conn, Message msg) {
        // Simple auth - just acknowledge
        // In production, validate token here
        Message ack = Message.ack("auth", Map.of("authenticated", true));
        conn.send(JsonUtil.toJson(ack));
    }

    private void handleSubscribe(WebSocket conn, Message msg) {
        if (msg.payload() instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) msg.payload();
            String channel = (String) payload.get("channel");
            
            if (channel != null) {
                channels.computeIfAbsent(channel, k -> new ConcurrentHashMap<>())
                    .put(conn, true);
                
                Message ack = Message.ack("subscribe", Map.of("channel", channel));
                conn.send(JsonUtil.toJson(ack));
                System.out.println("✓ Connection subscribed to channel: " + channel);
            }
        }
    }

    private void handleUnsubscribe(WebSocket conn, Message msg) {
        if (msg.payload() instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) msg.payload();
            String channel = (String) payload.get("channel");
            
            if (channel != null) {
                Map<WebSocket, Boolean> subscribers = channels.get(channel);
                if (subscribers != null) {
                    subscribers.remove(conn);
                }
                
                Message ack = Message.ack("unsubscribe", Map.of("channel", channel));
                conn.send(JsonUtil.toJson(ack));
                System.out.println("✓ Connection unsubscribed from channel: " + channel);
            }
        }
    }

    private void handleUserMessage(WebSocket conn, Message msg) {
        if (msg.payload() instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) msg.payload();
            String channel = (String) payload.get("channel");
            
            if (channel != null) {
                // Broadcast to all subscribers of the channel
                Map<WebSocket, Boolean> subscribers = channels.get(channel);
                if (subscribers != null) {
                    Message broadcast = Message.data(msg.action(), payload);
                    String broadcastJson = JsonUtil.toJson(broadcast);
                    
                    subscribers.keySet().forEach(subscriber -> {
                        if (subscriber != conn && subscriber.isOpen()) {
                            subscriber.send(broadcastJson);
                        }
                    });
                }
            }
        }

        // Acknowledge receipt
        Message ack = Message.ack("message", Map.of("received", true));
        conn.send(JsonUtil.toJson(ack));
    }

    private void handleHeartbeat(WebSocket conn, Message msg) {
        // Respond to heartbeat
        Message pong = Message.ack("heartbeat", Map.of("timestamp", System.currentTimeMillis()));
        conn.send(JsonUtil.toJson(pong));
    }

    /**
     * Broadcast message to all connections
     */
    public void broadcast(Message message) {
        String json = JsonUtil.toJson(message);
        connections.keySet().forEach(conn -> {
            if (conn.isOpen()) {
                conn.send(json);
            }
        });
    }

    /**
     * Broadcast message to specific channel
     */
    public void broadcastToChannel(String channel, Message message) {
        Map<WebSocket, Boolean> subscribers = channels.get(channel);
        if (subscribers != null) {
            String json = JsonUtil.toJson(message);
            subscribers.keySet().forEach(conn -> {
                if (conn.isOpen()) {
                    conn.send(json);
                }
            });
        }
    }
}
