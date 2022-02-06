var minicss = require('./fix-mini-css-plugin')
var ensure = require('./fix-ensure-import-plugin')
var movejs = require('./transfer-js-plugin')
var movevue = require('./transfer-vue-plugin')

module.exports = function pluginsInstall (config) {
  config.plugin('minicss').use(minicss)
  config.plugin('ensure').use(ensure)
  config.plugin('movejs').use(movejs)
  config.plugin('movevue').use(movevue)
}
