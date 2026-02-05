/**
 * 数据库服务工厂
 * 根据运行模式自动选择合适的数据库实现
 * 支持环境检测和自动降级
 */

import { WasmDatabaseService } from './wasm-database.js';
import { JarDatabaseService } from './jar-database.js';
import { MockDatabaseService } from './mock-database.js';

/**
 * 数据库服务工厂类
 */
export class DatabaseServiceFactory {
  /**
   * 创建数据库服务实例
   * @param {string} mode - 运行模式：'auto', 'wasm', 'jar', 'mock'
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} 数据库服务实例
   */
  static async create(mode = 'auto', options = {}) {
    let service;
    
    // Mock 模式（用于测试）
    if (mode === 'mock') {
      service = new MockDatabaseService();
      await service.init();
      return service;
    }
    
    // WASM 模式（纯浏览器）
    if (mode === 'wasm' || mode === 'light' || mode === 'pure') {
      service = new WasmDatabaseService();
      await service.init();
      return service;
    }
    
    // JAR 模式（桌面客户端）
    if (mode === 'jar') {
      service = new JarDatabaseService(options.baseUrl);
      await service.init();
      return service;
    }

    // Full 模式（JAR + WASM 都可用，优先使用 JAR）
    if (mode === 'full') {
      try {
        service = new JarDatabaseService(options.baseUrl);
        await service.init();
        console.log('✓ Database mode: JAR (full mode)');
        return service;
      } catch (error) {
        console.warn('JAR database unavailable in full mode, falling back to WASM:', error.message);
        service = new WasmDatabaseService();
        await service.init();
        console.log('✓ Database mode: WASM (full mode fallback)');
        return service;
      }
    }

    // 自动模式：先尝试 JAR，失败则降级到 WASM
    if (mode === 'auto') {
      try {
        service = new JarDatabaseService(options.baseUrl);
        await service.init();
        console.log('✓ Database mode: JAR');
        return service;
      } catch (error) {
        console.warn('JAR database unavailable, falling back to WASM:', error.message);
        
        try {
          service = new WasmDatabaseService();
          await service.init();
          console.log('✓ Database mode: WASM');
          return service;
        } catch (wasmError) {
          console.error('Both JAR and WASM databases failed:', wasmError.message);
          throw new Error('No database backend available');
        }
      }
    }
    
    throw new Error(`Unknown database mode: ${mode}`);
  }
  
  /**
   * 检测可用的数据库模式
   * @returns {Promise<string>} 'jar', 'wasm', 或 'none'
   */
  static async detectMode() {
    // 尝试 JAR
    try {
      const jarService = new JarDatabaseService();
      await jarService.init();
      await jarService.close();
      return 'jar';
    } catch (jarError) {
      // JAR 不可用，检查 WASM
      try {
        const wasmService = new WasmDatabaseService();
        await wasmService.init();
        await wasmService.close();
        return 'wasm';
      } catch (wasmError) {
        return 'none';
      }
    }
  }
}

// 导出各个实现供直接使用
export { WasmDatabaseService, JarDatabaseService, MockDatabaseService };

// 默认导出工厂
export default DatabaseServiceFactory;
