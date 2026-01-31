/**
 * DOM Utility Functions
 */

/**
 * Query selector wrapper
 * @param {string} selector - CSS selector
 * @param {Element} context - Context element (default: document)
 * @returns {Element|null}
 */
export function $(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Query selector all wrapper
 * @param {string} selector - CSS selector
 * @param {Element} context - Context element (default: document)
 * @returns {NodeList}
 */
export function $$(selector, context = document) {
  return context.querySelectorAll(selector);
}

/**
 * Create element with attributes and content
 * @param {string} tag - Tag name
 * @param {Object} attrs - Attributes
 * @param {string|Element|Element[]} children - Children
 * @returns {Element}
 */
export function createElement(tag, attrs = {}, children = null) {
  const el = document.createElement(tag);
  
  // Set attributes
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        el.dataset[dataKey] = dataValue;
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      const event = key.slice(2).toLowerCase();
      el.addEventListener(event, value);
    } else {
      el.setAttribute(key, value);
    }
  }
  
  // Add children
  if (children) {
    if (typeof children === 'string') {
      el.textContent = children;
    } else if (Array.isArray(children)) {
      children.forEach(child => {
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child));
        } else if (child instanceof Element) {
          el.appendChild(child);
        }
      });
    } else if (children instanceof Element) {
      el.appendChild(children);
    }
  }
  
  return el;
}

/**
 * Add class(es) to element
 * @param {Element} el - Element
 * @param {string|string[]} classes - Class name(s)
 */
export function addClass(el, classes) {
  const classList = Array.isArray(classes) ? classes : [classes];
  el.classList.add(...classList);
}

/**
 * Remove class(es) from element
 * @param {Element} el - Element
 * @param {string|string[]} classes - Class name(s)
 */
export function removeClass(el, classes) {
  const classList = Array.isArray(classes) ? classes : [classes];
  el.classList.remove(...classList);
}

/**
 * Toggle class on element
 * @param {Element} el - Element
 * @param {string} className - Class name
 * @param {boolean} force - Force add/remove
 */
export function toggleClass(el, className, force) {
  return el.classList.toggle(className, force);
}

/**
 * Check if element has class
 * @param {Element} el - Element
 * @param {string} className - Class name
 * @returns {boolean}
 */
export function hasClass(el, className) {
  return el.classList.contains(className);
}

/**
 * Set multiple attributes
 * @param {Element} el - Element
 * @param {Object} attrs - Attributes
 */
export function setAttributes(el, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
}

/**
 * Remove element from DOM
 * @param {Element} el - Element
 */
export function removeElement(el) {
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

/**
 * Empty element (remove all children)
 * @param {Element} el - Element
 */
export function empty(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

/**
 * Insert element after reference element
 * @param {Element} newEl - New element
 * @param {Element} refEl - Reference element
 */
export function insertAfter(newEl, refEl) {
  refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
}

/**
 * Get element offset from document
 * @param {Element} el - Element
 * @returns {Object} {top, left}
 */
export function getOffset(el) {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX
  };
}

/**
 * Check if element is visible in viewport
 * @param {Element} el - Element
 * @returns {boolean}
 */
export function isInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll element into view smoothly
 * @param {Element} el - Element
 * @param {Object} options - Scroll options
 */
export function scrollIntoView(el, options = {}) {
  el.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    ...options
  });
}

/**
 * Wait for element to appear in DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Element>}
 */
export function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = $(selector);
    if (el) {
      return resolve(el);
    }
    
    const observer = new MutationObserver(() => {
      const el = $(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

/**
 * Delegate event listener
 * @param {Element} parent - Parent element
 * @param {string} event - Event name
 * @param {string} selector - Child selector
 * @param {Function} handler - Event handler
 */
export function delegate(parent, event, selector, handler) {
  parent.addEventListener(event, (e) => {
    const target = e.target.closest(selector);
    if (target && parent.contains(target)) {
      handler.call(target, e);
    }
  });
}

export default {
  $,
  $$,
  createElement,
  addClass,
  removeClass,
  toggleClass,
  hasClass,
  setAttributes,
  removeElement,
  empty,
  insertAfter,
  getOffset,
  isInViewport,
  scrollIntoView,
  waitForElement,
  delegate
};
