var minicss = require('./fix-mini-css-plugin')
var ensure = require('./fix-ensure-import-plugin')
var movejs = require('./transfer-js-plugin')
var movevue = require('./transfer-vue-plugin')
var importComponent = require('./auto-import-component-plugin')

module.exports = function pluginsInstall (config,options) {
  config.plugin('minicss').use(minicss,options)
  config.plugin('ensure').use(ensure,options)
  config.plugin('movejs').use(movejs,options)
  config.plugin('movevue').use(movevue,options)
  config.plugin('importComponent').use(importComponent,options)
}
