# 🚀 Quick Start Guide - Authentication System

## What Was Built

A complete authentication system for Localverse OS with:
- **Device fingerprint-based authentication** (no passwords needed)
- **Token management** with HMAC-SHA256 signatures
- **Three-role permission system** (admin/user/guest)
- **First-time setup UI** with validation
- **Automatic authentication** on return visits
- **Comprehensive unit tests**

## Try It Out

### 1. Run the Interactive Demo

Open in your browser:
```
file:///path/to/localverse/src/frontend/desktop/demo-auth.html
```

**What you'll see:**
1. Welcome screen with setup form
2. Fill in your details (Employee ID, Name, Department)
3. Click "Complete Setup"
4. You're automatically authenticated!
5. Reload the page - you're still authenticated (auto-login)
6. Use the Demo Controls to test logout and re-authentication

### 2. Run the Unit Tests

Open in your browser:
```
file:///path/to/localverse/openspec/tests/unit/auth/test-runner.html
```

**What you'll see:**
1. Click "Run All Tests"
2. Watch all tests execute
3. Green checkmarks for passing tests
4. Results summary showing 100% pass rate

### 3. View the Architecture

Open in your browser:
```
file:///path/to/localverse/src/frontend/desktop/architecture.html
```

**What you'll see:**
- Visual diagram of the authentication system
- Flow charts for first-time and daily use
- Module breakdown and statistics

### 4. Integrate into Your App

```javascript
// Import the authentication service
import { authService } from './services/auth/index.js';

// On application startup
async function initApp() {
  const user = await authService.authenticate();
  
  if (user) {
    // User is authenticated - show main app
    console.log('Welcome back,', user.name);
    showMainApp(user);
  } else {
    // Need first-time setup
    showSetupUI();
  }
}

// For first-time setup
import { SetupUI } from './services/auth/index.js';

function showSetupUI() {
  const container = document.getElementById('app');
  const setupUI = new SetupUI(container);
  setupUI.render();
  
  setupUI.setOnComplete(async (userData) => {
    const user = await authService.setup(userData);
    showMainApp(user);
  });
}

// Check permissions before actions
import { hasPermission } from './services/auth/index.js';

function createCard() {
  const user = authService.getCurrentUser();
  
  if (hasPermission(user, 'card:create')) {
    // User can create cards
  } else {
    alert('You do not have permission to create cards');
  }
}
```

## Features in Action

### Device Fingerprinting
```javascript
import { generateDeviceId } from './services/auth/index.js';

const deviceId = await generateDeviceId();
// Returns: "d_a1b2c3d4e5f6g7h8"
// Same ID on every call (stable fingerprint)
```

### Token Management
```javascript
// Token is automatically managed
const token = await authService.getToken();
console.log(token);
// {
//   userId: "zhangsan",
//   userName: "张三",
//   department: "dev",
//   role: "user",
//   deviceId: "d_a1b2c3d4e5f6g7h8",
//   createdAt: 1709888888000,
//   expiresAt: 1712480888000,
//   signature: "sha256:..."
// }
```

### Permission Checking
```javascript
import { hasPermission, canAccessData } from './services/auth/index.js';

const user = authService.getCurrentUser();

// Check action permission
if (hasPermission(user, 'card:create')) {
  // Can create cards
}

// Check data access
const cardData = { created_by: 'user123', department: 'dev' };
if (canAccessData(user, cardData)) {
  // Can access this card
}
```

## Verify Installation

Run the verification script:
```bash
node src/scripts/verify-auth.js
```

You should see:
```
✅ All checks passed! Authentication module is properly structured.

📋 Next steps:
  1. Open test-runner.html in a browser to run unit tests
  2. Open demo-auth.html to see the setup UI in action
  3. Integrate with your application
```

## File Structure

```
src/frontend/desktop/
├── services/
│   └── auth/
│       ├── index.js               # Main exports
│       ├── device-fingerprint.js  # Device ID generation
│       ├── token-manager.js       # Token lifecycle
│       ├── auth-service.js        # Authentication logic
│       ├── permission.js          # RBAC system
│       ├── setup-ui.js           # Setup interface
│       └── README.md             # Full documentation
├── assets/
│   └── css/
│       └── auth.css              # Setup UI styles
├── demo-auth.html                # Interactive demo
└── architecture.html             # Visual docs

openspec/tests/unit/auth/
├── device-fingerprint.test.js    # Fingerprint tests
├── token-manager.test.js         # Token tests
├── permission.test.js            # Permission tests
├── auth-service.test.js          # Service tests
└── test-runner.html              # Test runner UI
```

## Key Concepts

### 1. Device Fingerprint
A unique ID generated from browser characteristics:
- User agent, language, platform
- Screen resolution and color depth
- Timezone
- Canvas rendering fingerprint
- WebGL renderer fingerprint

### 2. Token Structure
```javascript
{
  // User info
  userId: 'employee_id',
  userName: 'Display Name',
  department: 'dept_code',
  role: 'user|admin|guest',
  
  // Device info
  deviceId: 'd_...',
  deviceName: '...',
  platform: 'windows|macos|linux|...',
  
  // Timestamps
  createdAt: 1234567890,
  expiresAt: 1234567890,
  
  // Security
  signature: 'sha256:...'
}
```

### 3. Permission Model
- **admin**: Full access (wildcard `*` permission)
- **user**: Standard CRUD operations
- **guest**: Read-only access

### 4. Storage Strategy
- Primary: localStorage (fast access)
- Backup: IndexedDB (more reliable)
- Auto-sync between both

## Troubleshooting

### Tests fail in browser
- Make sure you're using a modern browser (Chrome 90+, Firefox 88+, Safari 14+)
- Check browser console for errors
- Verify files are being served (not blocked by CORS)

### Token not persisting
- Check localStorage is enabled
- Check IndexedDB is available
- Try clearing browser data and starting fresh

### Device ID changes
- This is normal after browser updates or significant setting changes
- The system will handle it gracefully

## Next Steps

1. **Integrate with main app**: Use `authService.authenticate()` in your app's entry point
2. **Add permission checks**: Protect sensitive operations with `hasPermission()`
3. **Customize roles**: Modify `permission.js` to add/remove permissions
4. **Configure refresh**: Adjust token expiry and refresh thresholds in `token-manager.js`
5. **Style the UI**: Customize `auth.css` to match your brand

## Support

- 📖 Full API docs: `src/frontend/desktop/services/auth/README.md`
- 🔧 Implementation details: `IMPLEMENTATION_SUMMARY.md`
- 📋 Task specification: `openspec/tasks/phase-0/task-005-authentication.md`
- 📐 Architecture spec: `openspec/specs/06-authentication.md`

---

**Status**: ✅ Complete and production-ready  
**Security**: ✅ 0 vulnerabilities (CodeQL verified)  
**Tests**: ✅ All passing  
**Documentation**: ✅ Comprehensive
