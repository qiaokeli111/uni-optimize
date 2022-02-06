const { normalizePath } = require("@dcloudio/uni-cli-shared")
const path = require('path')
const mainPath = normalizePath(path.resolve(process.env.UNI_INPUT_DIR, 'main.'))
const GraphHelpers = require("webpack/lib/GraphHelpers")


// 基础检测，vue和css类型不处理，只处理js类型
function baseTest(module) {
    if (module.type === "css/mini-extract") {
        return false
    }
    if (module.resource) {
        const resource = normalizePath(module.resource)
        if (
            resource.indexOf(".vue") !== -1 ||
            resource.indexOf(".nvue") !== -1 ||
            resource.indexOf(mainPath) === 0 // main.js
        ) {
            return false
        }
    }
    return true
}
const subPackageRoots = Object.keys(process.UNI_SUBPACKAGES).map(
    (root) => root + "/"
)
const findSubPackages = function (chunks) {
    return chunks.reduce((pkgs, item) => {
        const name = normalizePath(item.name)
        const pkgRoot = subPackageRoots.find((root) => name.indexOf(root) === 0)
        pkgRoot && pkgs.add(pkgRoot)
        return pkgs
    }, new Set())
}
const hasMainPackage = function (chunks) {
    return chunks.find(
        (item) => !subPackageRoots.find((root) => item.name.indexOf(root) === 0)
    )
}

const findNameChunk = function (chunks,name){
    return chunks.find(chunk=>chunk.name===name)
}

const VENDER_PATH = 'common/vendor'

class splitutilPlugin {
    constructor() {
        this.moveFiles = new Map()
    }

    apply(compiler) {
        compiler.hooks.thisCompilation.tap("splitutilPlugin", (compilation) => {
            compilation.hooks.optimizeChunksAdvanced.tap("splitutilPlugin", () => {
                  /**
                     *  有以下几种情况
                     * 1 主包js => 一个分包在用   uni已经处理好了，可以不管
                     * 2 主包js => 多个分包在用  uni把js已经放到主包，需要清除uni的副作用把主包的删了，然后放到各个分包去
                     * 3 主包js => 主包组件 => 分包页面 uni判断只要主包组件在使用就放到主包，这里比较复杂需要考虑分包插件将这个文件迁移到分包李
                     * 4 主包js => 主包组件 => 主包页面  不用处理
                     * uni 处理代码在node_modules\@dcloudio\vue-cli-plugin-uni\lib\split-chunks.js
                     */
                let waitDisposeModules = compilation.modules.filter(module=>baseTest(module))
                waitDisposeModules.forEach(module=>{
                    let chunks = module.getChunks()
                    
                    const matchSubPackages = findSubPackages(chunks)
                    let isMain = hasMainPackage(chunks)
                    // 只用处理大于一个分包在使用的情况，一个使用的情况uni已经处理好了，但是要考虑3的情况
                    if (matchSubPackages.size > 0 && !isMain) {
                        let name = module.resource
                        this.moveFiles.set(module,{
                            name:module.resource,
                            pkgSet:matchSubPackages
                        })
                    }
                })
                
            })
            compilation.hooks.optimizeChunkModules.tap("splitutilPlugin", (chunks,modules) => {
                modules.forEach(module=>{
                    if (this.moveFiles.has(module)) {
                        let mainChunks = module.getChunks()
                        // 如果不存在主包的common/vendor中，说明已经被uni放入分包了，就不需要做任何处理
                        if (mainChunks.length === 1 && mainChunks[0].name === VENDER_PATH) {
                            let mainChunk = mainChunks[0]
                            let moveFileInfo = this.moveFiles.get(module)
                            let chunkNames = []
                             moveFileInfo.pkgSet.forEach((value) => {
                                chunkNames.push(normalizePath(path.join(value, VENDER_PATH)))
                             });
                             chunkNames.forEach(chunkName=>{
                                let pkgChunk = findNameChunk(chunks,chunkName)
                                if (!pkgChunk) {
                                    let group = compilation.addChunkInGroup(chunkName)
                                    pkgChunk =group.chunks[0]
                                }
                                GraphHelpers.connectChunkAndModule(pkgChunk, module)
                             })
                             console.log(`${module.resource} 被放入分包${Array.from(moveFileInfo.pkgSet).join(',')}`);
                             GraphHelpers.disconnectChunkAndModule(mainChunk, module)
                        }
                    }
                })
            })
        })
    }
}
module.exports = splitutilPlugin
