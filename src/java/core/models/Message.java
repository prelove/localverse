package models;

import java.util.Map;
import java.util.UUID;

/**
 * WebSocket 消息模型
 */
public record Message(
    String id,
    String type,
    String action,
    Map<String, Object> payload,
    long timestamp
) {
    /**
     * 创建新消息
     */
    public static Message create(String type, String action, Map<String, Object> payload) {
        return new Message(
            UUID.randomUUID().toString(),
            type,
            action,
            payload,
            System.currentTimeMillis()
        );
    }

    /**
     * 创建事件消息
     */
    public static Message event(String action, Map<String, Object> payload) {
        return create("event", action, payload);
    }

    /**
     * 创建命令消息
     */
    public static Message command(String action, Map<String, Object> payload) {
        return create("command", action, payload);
    }

    /**
     * 创建数据消息
     */
    public static Message data(String action, Map<String, Object> payload) {
        return create("data", action, payload);
    }

    /**
     * 创建确认消息
     */
    public static Message ack(String action, Map<String, Object> payload) {
        return create("ack", action, payload);
    }

    /**
     * 创建心跳消息
     */
    public static Message heartbeat() {
        return create("heartbeat", "ping", Map.of());
    }
}
