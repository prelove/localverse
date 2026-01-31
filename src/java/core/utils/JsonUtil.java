package utils;

import com.google.gson.*;

import java.lang.reflect.Type;
import java.time.Instant;

/**
 * JSON 工具类
 */
public class JsonUtil {
    private static final Gson gson = new GsonBuilder()
            .setPrettyPrinting()
            .registerTypeAdapter(Instant.class, new InstantAdapter())
            .create();

    private static final Gson compactGson = new GsonBuilder()
            .registerTypeAdapter(Instant.class, new InstantAdapter())
            .create();

    /**
     * Instant 类型适配器
     */
    private static class InstantAdapter implements JsonSerializer<Instant>, JsonDeserializer<Instant> {
        @Override
        public JsonElement serialize(Instant src, Type typeOfSrc, JsonSerializationContext context) {
            return new JsonPrimitive(src.toEpochMilli());
        }

        @Override
        public Instant deserialize(JsonElement json, Type typeOfT, JsonDeserializationContext context) {
            return Instant.ofEpochMilli(json.getAsLong());
        }
    }

    /**
     * 对象转 JSON 字符串
     */
    public static String toJson(Object obj) {
        return gson.toJson(obj);
    }

    /**
     * 对象转紧凑 JSON 字符串（无格式化）
     */
    public static String toCompactJson(Object obj) {
        return compactGson.toJson(obj);
    }

    /**
     * JSON 字符串转对象
     */
    public static <T> T fromJson(String json, Class<T> clazz) {
        try {
            return gson.fromJson(json, clazz);
        } catch (JsonSyntaxException e) {
            throw new RuntimeException("Failed to parse JSON: " + e.getMessage(), e);
        }
    }

    /**
     * JSON 字符串转对象（支持泛型）
     */
    public static <T> T fromJson(String json, Type typeOfT) {
        try {
            return gson.fromJson(json, typeOfT);
        } catch (JsonSyntaxException e) {
            throw new RuntimeException("Failed to parse JSON: " + e.getMessage(), e);
        }
    }

    /**
     * 创建成功响应
     */
    public static String success(Object data) {
        var response = new Response(true, "Success", data);
        return toCompactJson(response);
    }

    /**
     * 创建错误响应
     */
    public static String error(String message) {
        var response = new Response(false, message, null);
        return toCompactJson(response);
    }

    /**
     * 创建错误响应（带异常）
     */
    public static String error(String message, Exception e) {
        var response = new Response(false, message + ": " + e.getMessage(), null);
        return toCompactJson(response);
    }

    /**
     * 响应记录
     */
    private record Response(boolean success, String message, Object data) {}
}
