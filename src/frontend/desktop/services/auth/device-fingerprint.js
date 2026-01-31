/**
 * Device Fingerprint Module
 * 
 * Generates stable device fingerprints for authentication.
 * Uses multiple browser characteristics to create a unique identifier.
 */

/**
 * Generate a unique device ID based on browser/device characteristics
 * @returns {Promise<string>} Device ID in format 'd_<16 hex chars>'
 */
export async function generateDeviceId() {
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    screen.width,
    screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    await getCanvasFingerprint(),
    await getWebGLFingerprint()
  ];
  
  const fingerprint = components.join('|');
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );
  
  return 'd_' + Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/**
 * Get canvas fingerprint
 * @returns {string} Canvas data URL
 */
function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Localverse fingerprint', 2, 2);
    return canvas.toDataURL();
  } catch (e) {
    return '';
  }
}

/**
 * Get WebGL fingerprint
 * @returns {string} WebGL renderer info
 */
function getWebGLFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return '';
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';
    
    return [
      gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
      gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    ].join('|');
  } catch (e) {
    return '';
  }
}

/**
 * Detect the platform/OS
 * @returns {string} Platform name (windows, macos, linux, android, ios, unknown)
 */
export function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  return 'unknown';
}
