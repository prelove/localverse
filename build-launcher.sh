#!/bin/bash

# Launcher 构建脚本
# 使用 Java 21 编译并打包 launcher.jar

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Building Launcher ===${NC}"

# 设置 Java 21
export JAVA_HOME=/usr/lib/jvm/temurin-21-jdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

# 验证 Java 版本
echo -e "${BLUE}Checking Java version...${NC}"
java -version

# 创建构建目录
BUILD_DIR="build/launcher"
DIST_DIR="dist"
SRC_DIR="src/java/launcher"

rm -rf $BUILD_DIR
mkdir -p $BUILD_DIR
mkdir -p $DIST_DIR

echo -e "${BLUE}Compiling Java sources...${NC}"

# 编译所有 Java 文件
javac -d $BUILD_DIR \
    --release 21 \
    $SRC_DIR/*.java

if [ $? -ne 0 ]; then
    echo -e "${RED}Compilation failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Compilation successful${NC}"

# 创建 MANIFEST.MF
echo -e "${BLUE}Creating manifest...${NC}"
cat > $BUILD_DIR/MANIFEST.MF << EOF
Manifest-Version: 1.0
Main-Class: Launcher
Created-By: Localverse Build Script
EOF

# 打包 JAR
echo -e "${BLUE}Packaging JAR...${NC}"
cd $BUILD_DIR
jar cfm ../../$DIST_DIR/launcher.jar MANIFEST.MF *.class
cd ../..

if [ $? -ne 0 ]; then
    echo -e "${RED}Packaging failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ JAR created${NC}"

# 检查文件大小
JAR_SIZE=$(stat -f%z "$DIST_DIR/launcher.jar" 2>/dev/null || stat -c%s "$DIST_DIR/launcher.jar" 2>/dev/null)
JAR_SIZE_KB=$((JAR_SIZE / 1024))

echo -e "${BLUE}JAR size: ${JAR_SIZE_KB}KB (${JAR_SIZE} bytes)${NC}"

if [ $JAR_SIZE -gt 20480 ]; then
    echo -e "${RED}WARNING: JAR size exceeds 20KB!${NC}"
else
    echo -e "${GREEN}✓ JAR size is within limit (< 20KB)${NC}"
fi

# 清理
echo -e "${BLUE}Cleaning up...${NC}"
rm -rf $BUILD_DIR

echo -e "${GREEN}=== Build Complete ===${NC}"
echo -e "Output: ${GREEN}$DIST_DIR/launcher.jar${NC}"
echo ""
echo "Usage:"
echo "  java -jar $DIST_DIR/launcher.jar"
echo "  java -jar $DIST_DIR/launcher.jar --version"
echo "  java -jar $DIST_DIR/launcher.jar --help"
