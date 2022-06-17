/* eslint-disable */

const path = require('path');
const loaderUtils = require('loader-utils')
const { normalizePath } = require("@dcloudio/uni-cli-shared")
const fs = require('fs')

class importPlugin {
    constructor (...arg) {
        this.components = arg
    }

    apply (compiler) {
        let entry = compiler.options.entry()
        let mainPath = entry['common/main']
        var entryPaths = []
        Object.keys(entry).forEach(e=>{
            if (e !== 'common/main') {
                let value = entry[e]
                var url = new URL(value);
                var params = loaderUtils.parseQuery(decodeURIComponent(url.search));
                let vuePagePath
                if (process.env.UNI_USING_NVUE_COMPILER) {
                    vuePagePath = path.resolve(process.env.UNI_INPUT_DIR, normalizePath(params.page) + '.vue')
                    if (!fs.existsSync(vuePagePath)) {
                      nvuePagePath = path.resolve(process.env.UNI_INPUT_DIR, normalizePath(params.page) +
                        '.nvue')
                      if (fs.existsSync(nvuePagePath)) {
                        ext = '.nvue'
                      }
                    }
                }
                entryPaths.push(vuePagePath)
            }
        })
        var entryLoader = {
            loader: require.resolve('./auto-import-component-plugin/insert-in-entry'),
            resource: query => {
                return mainPath === query
            },
            enforce:'pre',
            options: {
                components: this.components,
            }
        }
        let currentResource
        var vueAddComponentLoader = {
            loader: require.resolve('./auto-import-component-plugin/import-components'),
            resource: {
                test: resource => {
                  currentResource = resource
                  return true
                }
            },
            resourceQuery: (query) => {
                if (entryPaths.find(e=>e === currentResource)) {
                    const parsed = loaderUtils.parseQuery(query)
                    if (parsed.type === `template` && parsed.vue != null) {
                        return true
                    }
                }
               
                return false
            },
            enforce:'pre',
            options: {
                components: this.components,
            }
        }
       
        compiler.options.module.rules = [
            entryLoader,
            vueAddComponentLoader,
            ...compiler.options.module.rules
        ]
    }
}
module.exports = importPlugin;