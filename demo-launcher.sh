#!/bin/bash

# Launcher 使用示例
# 演示如何在实际场景中使用 launcher

set -e

export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=== Launcher Usage Example ===${NC}"
echo ""
echo "This script demonstrates how to use the launcher in a real scenario."
echo ""

# 创建示例目录
DEMO_DIR="/tmp/launcher-demo-$(date +%s)"
mkdir -p $DEMO_DIR
cd $DEMO_DIR

echo -e "${YELLOW}Setup:${NC}"
echo "  Working directory: $DEMO_DIR"
echo ""

# 复制 launcher
cp /home/runner/work/localverse/localverse/dist/launcher.jar .
echo -e "${GREEN}✓${NC} Copied launcher.jar"

# 创建一个简单的主程序
cat > SimpleApp.java << 'EOF'
public class SimpleApp {
    public static void main(String[] args) {
        System.out.println("Simple App v1.0 started");
        System.out.println("Running for 3 seconds...");
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("Simple App v1.0 exiting");
    }
}
EOF

javac SimpleApp.java
jar cfe localverse.jar SimpleApp SimpleApp.class
rm SimpleApp.class
echo -e "${GREEN}✓${NC} Created localverse.jar (v1.0)"
echo ""

# 场景 1: 首次启动
echo -e "${YELLOW}Scenario 1: First Launch${NC}"
echo "Running: java -jar launcher.jar"
echo ""
timeout 10 java -jar launcher.jar
echo ""
echo -e "${GREEN}✓${NC} Launcher started and managed localverse.jar successfully"
echo ""

# 显示生成的文件
echo -e "${YELLOW}Generated files:${NC}"
ls -lh launcher.jar localverse.jar version.json
echo ""
tree -L 2 . 2>/dev/null || find . -type f -o -type d | sed 's|^\./||' | sort
echo ""

# 显示 version.json
echo -e "${YELLOW}version.json content:${NC}"
cat version.json
echo ""

# 显示日志摘要
echo -e "${YELLOW}Log summary:${NC}"
tail -5 logs/launcher.log
echo ""

# 场景 2: 查看版本
echo -e "${YELLOW}Scenario 2: Check Version${NC}"
echo "Running: java -jar launcher.jar --version"
echo ""
java -jar launcher.jar --version
echo ""

# 场景 3: 模拟更新
echo -e "${YELLOW}Scenario 3: Simulating Update${NC}"

# 创建新版本
cat > SimpleApp2.java << 'EOF'
public class SimpleApp2 {
    public static void main(String[] args) {
        System.out.println("Simple App v2.0 started (NEW VERSION)");
        System.out.println("Running for 2 seconds...");
        try {
            Thread.sleep(2000);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        System.out.println("Simple App v2.0 exiting");
    }
}
EOF

javac SimpleApp2.java
jar cfe localverse-2.0.jar SimpleApp2 SimpleApp2.class
rm SimpleApp2.class

# 准备更新
mkdir -p temp
mv localverse-2.0.jar temp/
touch update_pending.flag

echo -e "${GREEN}✓${NC} Prepared update: v2.0 in temp/"
echo -e "${GREEN}✓${NC} Created update_pending.flag"
echo ""

echo "Running: java -jar launcher.jar (will detect and apply update)"
echo ""
timeout 10 java -jar launcher.jar
echo ""

echo -e "${GREEN}✓${NC} Update applied successfully"
echo ""

# 验证更新
echo -e "${YELLOW}After update:${NC}"
ls -lh localverse.jar localverse.jar.bak
echo ""

echo -e "${YELLOW}Updated version.json:${NC}"
cat version.json
echo ""

# 清理
echo -e "${BLUE}Cleaning up...${NC}"
cd /
rm -rf $DEMO_DIR

echo ""
echo -e "${GREEN}=== Demo Complete ===${NC}"
echo ""
echo "Key points demonstrated:"
echo "  1. ✓ First launch creates version.json and logs"
echo "  2. ✓ Version command shows current state"
echo "  3. ✓ Update detection and application"
echo "  4. ✓ Automatic backup creation"
echo "  5. ✓ Version tracking in version.json"
