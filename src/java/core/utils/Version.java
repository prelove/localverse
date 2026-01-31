package utils;

/**
 * 版本信息常量
 */
public class Version {
    public static final String VERSION = "1.0.0";
    public static final String NAME = "Localverse OS";
    
    private Version() {
        // Utility class, prevent instantiation
    }
    
    /**
     * 获取完整版本字符串
     */
    public static String getFullVersion() {
        return NAME + " " + VERSION;
    }
}
