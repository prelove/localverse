#!/bin/bash

# Launcher 测试脚本
# 测试各种场景：正常启动、更新、崩溃、回滚等

set -e

# 设置 Java 21
export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Launcher Test Suite ===${NC}"
echo ""

# 创建测试目录
TEST_DIR="/tmp/launcher-test-$(date +%s)"
mkdir -p $TEST_DIR
cd $TEST_DIR

echo -e "${BLUE}Test directory: $TEST_DIR${NC}"
echo ""

# 复制 launcher.jar
cp /home/runner/work/localverse/localverse/dist/launcher.jar .

# 创建测试用的 localverse.jar
echo -e "${BLUE}Creating test localverse.jar...${NC}"
cat > TestMain.java << 'EOF'
public class TestMain {
    public static void main(String[] args) {
        String version = System.getProperty("test.version", "1.0.0");
        System.out.println("TestMain version " + version + " started");
        
        if (args.length > 0) {
            String action = args[0];
            System.out.println("Action: " + action);
            
            if (action.equals("crash")) {
                System.exit(42);
            } else if (action.equals("restart")) {
                System.exit(100);
            } else if (action.equals("rollback")) {
                System.exit(101);
            }
        }
        
        try {
            Thread.sleep(1000);
        } catch (InterruptedException e) {
            // ignore
        }
        
        System.out.println("TestMain exiting normally");
        System.exit(0);
    }
}
EOF

javac TestMain.java
jar cfe localverse.jar TestMain TestMain.class

echo -e "${GREEN}✓ Test JAR created${NC}"
echo ""

# 测试 1: --help 命令
echo -e "${YELLOW}Test 1: --help command${NC}"
java -jar launcher.jar --help > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Test 1 passed${NC}"
else
    echo -e "${RED}✗ Test 1 failed${NC}"
    exit 1
fi
echo ""

# 测试 2: --version 命令
echo -e "${YELLOW}Test 2: --version command${NC}"
java -jar launcher.jar --version > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Test 2 passed${NC}"
else
    echo -e "${RED}✗ Test 2 failed${NC}"
    exit 1
fi
echo ""

# 测试 3: 正常启动
echo -e "${YELLOW}Test 3: Normal startup and exit${NC}"
timeout 10 java -jar launcher.jar > test3.log 2>&1
if [ $? -eq 0 ]; then
    if grep -q "Process exited normally" test3.log; then
        echo -e "${GREEN}✓ Test 3 passed${NC}"
    else
        echo -e "${RED}✗ Test 3 failed - Process did not exit normally${NC}"
        cat test3.log
        exit 1
    fi
else
    echo -e "${RED}✗ Test 3 failed${NC}"
    cat test3.log
    exit 1
fi
echo ""

# 测试 4: version.json 生成
echo -e "${YELLOW}Test 4: version.json generation${NC}"
if [ -f version.json ]; then
    if grep -q '"current"' version.json && grep -q '"lastGood"' version.json; then
        echo -e "${GREEN}✓ Test 4 passed${NC}"
    else
        echo -e "${RED}✗ Test 4 failed - version.json format incorrect${NC}"
        cat version.json
        exit 1
    fi
else
    echo -e "${RED}✗ Test 4 failed - version.json not created${NC}"
    exit 1
fi
echo ""

# 测试 5: 日志文件生成
echo -e "${YELLOW}Test 5: Log file generation${NC}"
if [ -f logs/launcher.log ]; then
    if grep -q "Launcher started" logs/launcher.log; then
        echo -e "${GREEN}✓ Test 5 passed${NC}"
    else
        echo -e "${RED}✗ Test 5 failed - log content incorrect${NC}"
        cat logs/launcher.log
        exit 1
    fi
else
    echo -e "${RED}✗ Test 5 failed - log file not created${NC}"
    exit 1
fi
echo ""

# 测试 6: --check-update（无更新）
echo -e "${YELLOW}Test 6: --check-update (no update)${NC}"
output=$(java -jar launcher.jar --check-update 2>&1)
if echo "$output" | grep -q "No update pending"; then
    echo -e "${GREEN}✓ Test 6 passed${NC}"
else
    echo -e "${RED}✗ Test 6 failed${NC}"
    echo "$output"
    exit 1
fi
echo ""

# 测试 7: 更新标记检测
echo -e "${YELLOW}Test 7: Update flag detection${NC}"
# 创建更新标记和新版本
mkdir -p temp
cp localverse.jar temp/localverse-1.1.0.jar
touch update_pending.flag

# 启动 launcher（会检测到更新）
timeout 10 java -jar launcher.jar > test7.log 2>&1

if grep -q "Update pending" test7.log && grep -q "Update completed successfully" test7.log; then
    echo -e "${GREEN}✓ Test 7 passed${NC}"
else
    echo -e "${RED}✗ Test 7 failed - Update not detected or applied${NC}"
    cat test7.log
    exit 1
fi
echo ""

# 测试 8: 备份文件创建
echo -e "${YELLOW}Test 8: Backup file creation${NC}"
if [ -f localverse.jar.bak ]; then
    echo -e "${GREEN}✓ Test 8 passed${NC}"
else
    echo -e "${RED}✗ Test 8 failed - Backup file not created${NC}"
    exit 1
fi
echo ""

# 清理
echo -e "${BLUE}Cleaning up test directory...${NC}"
cd /
rm -rf $TEST_DIR

echo ""
echo -e "${GREEN}=== All Tests Passed ===${NC}"
echo -e "${GREEN}✓ 8/8 tests successful${NC}"
