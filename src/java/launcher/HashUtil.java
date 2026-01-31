import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * 哈希工具类 - 计算和验证文件的 SHA-256 哈希值
 */
public class HashUtil {
    
    private static final char[] HEX_CHARS = "0123456789abcdef".toCharArray();
    
    /**
     * 计算文件的 SHA-256 哈希值
     * 
     * @param filePath 文件路径
     * @return 格式为 "sha256:xxxxx" 的哈希字符串
     * @throws IOException 文件读取异常
     */
    public static String calculateSHA256(Path filePath) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] fileBytes = Files.readAllBytes(filePath);
            byte[] hashBytes = digest.digest(fileBytes);
            return "sha256:" + bytesToHex(hashBytes);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is always available in JDK
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
    
    /**
     * 验证文件的哈希值
     * 
     * @param filePath 文件路径
     * @param expectedHash 期望的哈希值（格式：sha256:xxxxx）
     * @return 是否匹配
     */
    public static boolean verifyHash(Path filePath, String expectedHash) {
        try {
            String actualHash = calculateSHA256(filePath);
            return actualHash.equals(expectedHash);
        } catch (IOException e) {
            return false;
        }
    }
    
    /**
     * 字节数组转十六进制字符串
     */
    private static String bytesToHex(byte[] bytes) {
        char[] hexChars = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            int v = bytes[i] & 0xFF;
            hexChars[i * 2] = HEX_CHARS[v >>> 4];
            hexChars[i * 2 + 1] = HEX_CHARS[v & 0x0F];
        }
        return new String(hexChars);
    }
}
