const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(process.argv[2] || 'src/frontend/desktop');
const entry = path.resolve(rootDir, 'app.js');
const outFile = path.resolve(rootDir, 'app.bundle.js');

const modules = new Map();
let exportVarCounter = 0;

function toModuleId(filePath) {
  const rel = path.relative(rootDir, filePath).replace(/\\/g, '/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function resolveImport(importPath, fromFile) {
  if (!importPath.startsWith('.')) return null;
  return path.resolve(path.dirname(fromFile), importPath);
}

function collect(filePath) {
  const absPath = path.resolve(filePath);
  if (modules.has(absPath)) return;
  const code = fs.readFileSync(absPath, 'utf8');
  modules.set(absPath, code);

  const importRegex = /import\s+(?:[^'"\n]+?\s+from\s+)?['"]([^'"]+)['"];?/g;
  let match;
  while ((match = importRegex.exec(code))) {
    const spec = match[1];
    const resolved = resolveImport(spec, absPath);
    if (resolved) {
      collect(resolved);
    }
  }

  const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(code))) {
    const spec = match[1];
    const resolved = resolveImport(spec, absPath);
    if (resolved) {
      collect(resolved);
    }
  }
}

function nextReexportVar() {
  exportVarCounter += 1;
  return `__reexport_${exportVarCounter}`;
}

function transformModule(code, filePath) {
  let output = code;

  output = output.replace(/import\s+([^'"\n]+?)\s+from\s+['"]([^'"]+)['"];?/g, (full, spec, source) => {
    if (!source.startsWith('.')) return full;
    const resolved = resolveImport(source, filePath);
    const moduleId = toModuleId(resolved);
    const trimmed = spec.trim();
    if (trimmed.startsWith('{')) {
      return `const ${trimmed} = __require('${moduleId}');`;
    }
    if (trimmed.startsWith('* as ')) {
      const name = trimmed.replace('* as ', '').trim();
      return `const ${name} = __require('${moduleId}');`;
    }
    if (trimmed.includes(',')) {
      const [defaultName, named] = trimmed.split(',');
      const safeDefault = defaultName.trim();
      const reqName = nextReexportVar();
      return `const ${reqName} = __require('${moduleId}'); const ${safeDefault} = ${reqName}.default ?? ${reqName}; const ${named.trim()} = ${reqName};`;
    }
    return `const ${trimmed} = __require('${moduleId}').default ?? __require('${moduleId}');`;
  });

  output = output.replace(/import\s+['"]([^'"]+)['"];?/g, (full, source) => {
    if (!source.startsWith('.')) return full;
    const resolved = resolveImport(source, filePath);
    const moduleId = toModuleId(resolved);
    return `__require('${moduleId}');`;
  });

  output = output.replace(/import\(\s*['"]([^'"]+)['"]\s*\)/g, (full, source) => {
    if (!source.startsWith('.')) return full;
    const resolved = resolveImport(source, filePath);
    const moduleId = toModuleId(resolved);
    return `Promise.resolve(__require('${moduleId}'))`;
  });

  output = output.replace(/export\s+default\s+class\s+([A-Za-z0-9_]+)/g, (full, name) => {
    return `class ${name}`;
  });
  output = output.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, (full, name) => {
    return `function ${name}`;
  });

  output = output.replace(/export\s+class\s+([A-Za-z0-9_]+)/g, (full, name) => {
    return `class ${name}`;
  });
  output = output.replace(/export\s+function\s+([A-Za-z0-9_]+)/g, (full, name) => {
    return `function ${name}`;
  });
  output = output.replace(/export\s+const\s+([A-Za-z0-9_]+)/g, (full, name) => {
    return `const ${name}`;
  });

  output = output.replace(/export\s+\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"];?/g, (full, exportsBlock, source) => {
    if (!source.startsWith('.')) return full;
    const resolved = resolveImport(source, filePath);
    const moduleId = toModuleId(resolved);
    const entries = exportsBlock.split(',').map((chunk) => chunk.trim()).filter(Boolean);
    const reqName = nextReexportVar();
    const lines = [`const ${reqName} = __require('${moduleId}');`];
    entries.forEach((entry) => {
      const [orig, alias] = entry.split(/\s+as\s+/).map((part) => part.trim());
      const target = alias || orig;
      if (target === 'default') {
        lines.push(`exports.default = ${reqName}['${orig}'];`);
      } else {
        lines.push(`exports.${target} = ${reqName}['${orig}'];`);
      }
    });
    return lines.join(' ');
  });

  output = output.replace(/export\s+\{([\s\S]*?)\};?/g, (full, exportsBlock) => {
    const entries = exportsBlock.split(',').map((chunk) => chunk.trim()).filter(Boolean);
    const lines = entries.map((entry) => {
      const [orig, alias] = entry.split(/\s+as\s+/).map((part) => part.trim());
      const target = alias || orig;
      if (target === 'default') {
        return `exports.default = ${orig};`;
      }
      return `exports.${target} = ${orig};`;
    });
    return lines.join(' ');
  });

  output = output.replace(/export\s+default\s+([^;\n]+);?/g, (full, expr) => {
    return `exports.default = ${expr};`;
  });

  const exportableDeclRegex = /(class|function|const)\s+([A-Za-z0-9_]+)/g;
  const exportNames = new Set();
  let match;
  while ((match = exportableDeclRegex.exec(code))) {
    if (code.includes(`export ${match[1]} ${match[2]}`)) {
      exportNames.add(match[2]);
    }
  }
  if (exportNames.size) {
    exportNames.forEach((name) => {
      output += `\nexports.${name} = ${name};`;
    });
  }

  if (code.includes('export default class')) {
    const matchDefault = code.match(/export\s+default\s+class\s+([A-Za-z0-9_]+)/);
    if (matchDefault) {
      output += `\nexports.default = ${matchDefault[1]};`;
    }
  }
  if (code.includes('export default function')) {
    const matchDefault = code.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/);
    if (matchDefault) {
      output += `\nexports.default = ${matchDefault[1]};`;
    }
  }

  return output;
}

collect(entry);

let bundle = `(function(){\n`;
bundle += `const __modules = {};\nconst __cache = {};\n`;
bundle += `function __define(id, factory){ __modules[id] = factory; }\n`;
bundle += `function __require(id){ if(__cache[id]) return __cache[id].exports; if(!__modules[id]) throw new Error('Module not found: ' + id); const module = { exports: {} }; __cache[id] = module; __modules[id](module, module.exports); return module.exports; }\n`;

modules.forEach((code, absPath) => {
  const id = toModuleId(absPath);
  const transformed = transformModule(code, absPath);
  bundle += `__define('${id}', function(module, exports){\n${transformed}\n});\n`;
});

bundle += `__require('${toModuleId(entry)}');\n`;
bundle += `})();\n`;

fs.writeFileSync(outFile, bundle, 'utf8');
console.log(`Bundle written to ${outFile}`);
