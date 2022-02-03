var minicss = require('./fix-mini-css-plugin')
var ensure = require('./fix-ensure-import-plugin')

module.exports = function pluginsInstall (config) {
  config.plugin('minicss').use(minicss)
  config.plugin('ensure').use(ensure)
}
