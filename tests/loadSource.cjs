const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
module.exports = function loadSource(filename, overrides = {}, cache = new Map()) {
  const absolute = path.resolve(filename);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  const code = babel.transformSync(fs.readFileSync(absolute, 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const localRequire = name => name in overrides ? overrides[name] : name.startsWith('.')
    ? loadSource(path.resolve(path.dirname(absolute), name + (path.extname(name) ? '' : '.js')), overrides, cache) : require(name);
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
};
