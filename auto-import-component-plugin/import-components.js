/* eslint-disable */
const loaderUtils = require('loader-utils')
const path = require("path");
function genComponetCode (component, args) {
  var tempParams = ''
  if (Object.prototype.toString.call(args) === '[object Array]') {
    args.forEach(param => {
      tempParams += `
      ${param.key}="${param.value}"`
    })
    return `
    <${component.name}${tempParams}
    />
    `
  }
}
function findElementTagContent (source, tag) {
  var reg = new RegExp(`<(${tag})[^>]*>((.|\\n|\\r)*)<\\/(${tag})[^>]*>`)
  let result = source.match(reg)
  if (result && result[2]) {
    return result[2]
  }
  return null
}
function findFirstElementTag (source) {
  var reg = new RegExp(`<[\\w-]+`)
  let result = source.match(reg)
  if (result && result[0]) {
    return result[0].substring(1, result[0].length)
  }
  return null
}
function insertCode (source, code) {
  let templateContent = findElementTagContent(source, 'template')
  if (templateContent) {
    var firstTag = findFirstElementTag(templateContent)
    if (firstTag) {
      let firstTagContent = findElementTagContent(templateContent, firstTag)
      if (firstTagContent) {
        var addComponentContent = firstTagContent + code
        source = source.replace(firstTagContent, addComponentContent)
      }
    }
  }
  return source
}

module.exports = function (source) {
  const options = loaderUtils.getOptions(this)
  const { resourcePath } = this
  let code = ''
  options.components.forEach(component => {
    var arg = {}
    if (path.resolve(component.src) !==resourcePath) {
        if (
            !component.excludeFun ||
            (component.excludeFun && !component.excludeFun(resourcePath))
          ) {
            if (component.paramFun) {
              arg = component.paramFun(resourcePath)
            }
            let componentCode = genComponetCode(component, arg)
            code += componentCode
          }
    }
  })
  return insertCode(source, code)
}
