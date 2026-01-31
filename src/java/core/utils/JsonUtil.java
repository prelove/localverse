package utils;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;

/**
 * JSON utilities for serialization/deserialization
 */
public class JsonUtil {
    private static final Gson gson = new Gson();
    private static final Gson prettyGson = new GsonBuilder().setPrettyPrinting().create();

    /**
     * Convert object to JSON string
     */
    public static String toJson(Object obj) {
        return gson.toJson(obj);
    }

    /**
     * Convert object to pretty JSON string
     */
    public static String toPrettyJson(Object obj) {
        return prettyGson.toJson(obj);
    }

    /**
     * Parse JSON string to object
     */
    public static <T> T fromJson(String json, Class<T> clazz) {
        return gson.fromJson(json, clazz);
    }

    /**
     * Parse JSON string to JsonElement
     */
    public static JsonElement parse(String json) {
        return gson.fromJson(json, JsonElement.class);
    }

    /**
     * Convert JsonElement to object
     */
    public static <T> T fromJsonElement(JsonElement element, Class<T> clazz) {
        return gson.fromJson(element, clazz);
    }
}
