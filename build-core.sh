#!/bin/bash

# Localverse Core 构建脚本
# 使用 Maven 编译并打包 localverse.jar

set -e

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Building Localverse Core ===${NC}"

# 检查 Maven
if ! command -v mvn &> /dev/null; then
    echo -e "${RED}Maven not found! Please install Maven.${NC}"
    exit 1
fi

# 验证 Java 版本
echo -e "${BLUE}Checking Java version...${NC}"
java -version

# 清理之前的构建
echo -e "${BLUE}Cleaning previous build...${NC}"
mvn clean

# 编译和打包
echo -e "${BLUE}Building project...${NC}"
mvn package

if [ $? -ne 0 ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# 检查文件
if [ -f "dist/localverse.jar" ]; then
    JAR_SIZE=$(stat -f%z "dist/localverse.jar" 2>/dev/null || stat -c%s "dist/localverse.jar" 2>/dev/null)
    JAR_SIZE_KB=$((JAR_SIZE / 1024))
    
    echo -e "${BLUE}JAR size: ${JAR_SIZE_KB}KB (${JAR_SIZE} bytes)${NC}"
    echo -e "${GREEN}=== Build Complete ===${NC}"
    echo -e "Output: ${GREEN}dist/localverse.jar${NC}"
    echo -e "Dependencies: ${GREEN}dist/lib/${NC}"
    echo ""
    echo "Usage:"
    echo "  java -jar dist/localverse.jar"
    echo "  java -jar dist/localverse.jar --help"
else
    echo -e "${RED}JAR file not found!${NC}"
    exit 1
fi
