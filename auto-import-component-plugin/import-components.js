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
function genComponetCodeByParcel(component, args,parcelCode) {
    var tempParams = ''
    if (Object.prototype.toString.call(args) === '[object Array]') {
        args.forEach(param => {
        tempParams += `
        ${param.key}="${param.value}"`
        })
        return `
        <${component.name}${tempParams}
        >
            ${parcelCode}
        </${component.name} >
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
function findElementCloseTag(source, tag) {
    var reg = new RegExp(`<${tag}[^>]*\/>`)
    let result = source.match(reg)
    if (result && result[0]) {
        return result[0]
    }
    return null
}
function insertCode (source, code) {
  let templateContent = findElementTagContent(source, 'template')
  if (templateContent) {
    var firstTag = findFirstElementTag(templateContent)
    if (firstTag) {
      let firstTagContent = findElementTagContent(templateContent, firstTag)
      var addComponentContent = firstTagContent
      // 有标签但是没有标签内容说明是闭合标签，那么在外层加一个view
      if (firstTagContent) {
        addComponentContent = firstTagContent + code
        source = source.replace(firstTagContent, addComponentContent)
      }else{
        let closeTag = findElementCloseTag(templateContent, firstTag)
        addComponentContent = `
<view>
    ${closeTag}
    ${code}
</view>
        `
        source = source.replace(closeTag, addComponentContent)
      }
     
    }
  }
  return source
}

function insertCodeByParcel(source, code) {
    let templateContent = findElementTagContent(source, 'template')
    if (templateContent) {
        let temp = code.replace(REPLACR_WORD, templateContent)
        source = source.replace(templateContent, temp)
    }
    return source
}
const REPLACR_WORD = 'CCCXXX'
module.exports = function (source) {
  const options = loaderUtils.getOptions(this)
  const { resourcePath } = this
  
  let code = '',parcelCode = REPLACR_WORD,parcelComponents= []
  options.components.forEach(component => {
    var arg = {}
    if (path.resolve(component.src) !==resourcePath) {
        if (
            !component.excludeFun ||
            (component.excludeFun && !component.excludeFun(resourcePath))
          ) {
            if (component.parcelFun(resourcePath)) {
                parcelComponents.push(component)
            }else{
                if (component.paramFun) {
                    arg = component.paramFun(resourcePath)
                }
                let componentCode = genComponetCode(component, arg)
                code += componentCode
            }
        }
    }
  })
  parcelComponents.forEach(component=>{
    if (component.paramFun) {
        arg = component.paramFun(resourcePath)
    }
    let componentCode = genComponetCodeByParcel(component, arg,parcelCode)
    parcelCode = componentCode
  })
  let result = insertCode(source, code)
  result = insertCodeByParcel(result, parcelCode)
  if (result === source &&  (code !== '' || parcelCode !== '')) {
    console.log(`页面没有成功导入组件：${resourcePath}`)
  }
  return result
}
