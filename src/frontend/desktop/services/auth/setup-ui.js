/**
 * Setup UI Module
 * 
 * Handles the first-time setup interface for user configuration.
 */

/**
 * Setup UI Class
 */
export class SetupUI {
  /**
   * Create a new SetupUI instance
   * @param {HTMLElement} container - Container element for the UI
   */
  constructor(container) {
    this.container = container;
    this.onComplete = null;
  }
  
  /**
   * Render the setup form
   */
  render() {
    this.container.innerHTML = `
      <div class="setup-container">
        <div class="setup-card">
          <div class="setup-header">
            <h1>欢迎使用 Localverse</h1>
            <p>请填写以下信息完成初始化</p>
          </div>
          
          <form id="setupForm" class="setup-form">
            <div class="form-group">
              <label for="userId">工号 <span class="required">*</span></label>
              <input type="text" id="userId" name="userId" required
                     pattern="[a-zA-Z0-9_]+"
                     placeholder="例如: zhangsan"
                     autocomplete="off">
              <span class="form-hint">字母、数字、下划线</span>
            </div>
            
            <div class="form-group">
              <label for="userName">姓名 <span class="required">*</span></label>
              <input type="text" id="userName" name="userName" required
                     placeholder="例如: 张三">
            </div>
            
            <div class="form-group">
              <label for="department">部门 <span class="required">*</span></label>
              <select id="department" name="department" required>
                <option value="">请选择</option>
                <option value="dev">开发部</option>
                <option value="qa">测试部</option>
                <option value="ops">运维部</option>
                <option value="product">产品部</option>
                <option value="design">设计部</option>
                <option value="hr">人事部</option>
                <option value="finance">财务部</option>
                <option value="admin">行政部</option>
              </select>
            </div>
            
            <button type="submit" class="btn-primary btn-block">
              完成设置
            </button>
          </form>
          
          <div class="setup-footer">
            <p>数据将保存在本地设备上</p>
          </div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }
  
  /**
   * Bind form events
   */
  bindEvents() {
    const form = this.container.querySelector('#setupForm');
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(form);
      const userData = {
        userId: formData.get('userId'),
        userName: formData.get('userName'),
        department: formData.get('department'),
        role: 'user'
      };
      
      // Validate
      if (!this.validate(userData)) {
        return;
      }
      
      // Disable button
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = '设置中...';
      
      try {
        if (this.onComplete) {
          await this.onComplete(userData);
        }
      } catch (error) {
        console.error('Setup failed:', error);
        alert('设置失败，请重试');
        submitBtn.disabled = false;
        submitBtn.textContent = '完成设置';
      }
    });
  }
  
  /**
   * Validate user data
   * @param {Object} userData - User data to validate
   * @returns {boolean} True if valid
   */
  validate(userData) {
    if (!/^[a-zA-Z0-9_]+$/.test(userData.userId)) {
      alert('工号只能包含字母、数字和下划线');
      return false;
    }
    
    if (userData.userName.length < 2) {
      alert('姓名至少2个字符');
      return false;
    }
    
    if (!userData.department) {
      alert('请选择部门');
      return false;
    }
    
    return true;
  }
  
  /**
   * Set completion callback
   * @param {Function} callback - Callback function
   */
  setOnComplete(callback) {
    this.onComplete = callback;
  }
}
