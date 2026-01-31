/**
 * Permission Manager
 * 权限管理器 - 控制插件的权限访问
 */

const PERMISSIONS = {
  'database:read': {
    name: '读取数据库',
    risk: 'low'
  },
  'database:write': {
    name: '写入数据库',
    risk: 'medium'
  },
  'filesystem:read': {
    name: '读取文件',
    risk: 'medium'
  },
  'filesystem:write': {
    name: '写入文件',
    risk: 'high'
  },
  'filesystem:watch': {
    name: '监视文件',
    risk: 'low'
  },
  'network:local': {
    name: '本地网络',
    risk: 'low'
  },
  'network:sync': {
    name: '同步服务',
    risk: 'medium'
  },
  'notification': {
    name: '发送通知',
    risk: 'low'
  },
  'clipboard:read': {
    name: '读取剪贴板',
    risk: 'medium'
  },
  'clipboard:write': {
    name: '写入剪贴板',
    risk: 'low'
  },
  'search': {
    name: '搜索服务',
    risk: 'low'
  }
};

export class PermissionManager {
  constructor() {
    this.grants = new Map(); // pluginId -> Set<permission>
  }
  
  grant(pluginId, permissions) {
    let grants = this.grants.get(pluginId);
    if (!grants) {
      grants = new Set();
      this.grants.set(pluginId, grants);
    }
    
    for (const permission of permissions) {
      grants.add(permission);
    }
  }
  
  revoke(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (grants) {
      grants.delete(permission);
    }
  }
  
  revokeAll(pluginId) {
    this.grants.delete(pluginId);
  }
  
  hasPermission(pluginId, permission) {
    const grants = this.grants.get(pluginId);
    if (!grants) return false;
    
    // 检查通配符
    if (grants.has('*')) return true;
    
    // 检查具体权限
    if (grants.has(permission)) return true;
    
    // 检查父权限（例如 database:* 包含 database:read）
    const [category] = permission.split(':');
    if (grants.has(`${category}:*`)) return true;
    
    return false;
  }
  
  getGranted(pluginId) {
    const grants = this.grants.get(pluginId);
    return grants ? Array.from(grants) : [];
  }
  
  getPermissionInfo(permission) {
    return PERMISSIONS[permission] || { name: permission, risk: 'unknown' };
  }
  
  getAllPermissions() {
    return PERMISSIONS;
  }
}

export default PermissionManager;
