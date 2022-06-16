const loaderUtils = require("loader-utils");
const path = require("path");
const slash = require("slash");
module.exports = function (source) {
  const options = loaderUtils.getOptions(this);

  var code = ``;
  options.components.forEach((component) => {
    code += `
import ${component.name} from '${slash(path.resolve(component.src))}';
Vue.component('${component.name}', ${component.name})
        `;
  });
  return source + code;
};
