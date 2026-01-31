package models;

import java.util.UUID;

/**
 * WebSocket message model
 */
public record Message(
    String id,
    String type,
    String action,
    Object payload,
    long timestamp
) {
    public Message(String type, String action, Object payload) {
        this(UUID.randomUUID().toString(), type, action, payload, System.currentTimeMillis());
    }

    public static Message event(String action, Object payload) {
        return new Message("event", action, payload);
    }

    public static Message command(String action, Object payload) {
        return new Message("command", action, payload);
    }

    public static Message data(String action, Object payload) {
        return new Message("data", action, payload);
    }

    public static Message ack(String action, Object payload) {
        return new Message("ack", action, payload);
    }

    public static Message error(String action, String errorMessage) {
        return new Message("error", action, new ErrorPayload(errorMessage));
    }

    public record ErrorPayload(String error) {}
}
