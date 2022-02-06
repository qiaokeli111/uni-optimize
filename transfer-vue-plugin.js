/* eslint-disable */

const {
    getComponentSet,
    getJsonFileMap,
    getPageSet,
    updateComponentJson,
} = require("@dcloudio/uni-cli-shared/lib/cache")
const { removeExt, normalizePath } = require("@dcloudio/uni-cli-shared")
const {
    restoreNodeModules,
} = require("@dcloudio/webpack-uni-mp-loader/lib/shared")
const GraphHelpers = require("webpack/lib/GraphHelpers")
const path = require("path")
const { generateCodeFrame } = require("vue-template-compiler")

const isWin = /^win/.test(process.platform)
var hasEmit = false
class chunkMeta {
    constructor(chunk) {
        this.parents = []
        this.childs = []
        this.isMain = false
        this.deep = 0
        this.pkgs = new Set()
        this.relevanceObjs = {}
        this.moveNames = new Set()
        this.chunk = chunk
    }
    addParent(parentMeta) {
        if (!parentMeta instanceof chunkMeta) {
            console.log("添加父类不是 chunkMeta类型")
        }
        this.parents.push(parentMeta)
        parentMeta.childs.push(this)
    }
    setStatusWithChild(isMain) {
        this.isMain = isMain
        this.childs.forEach((childMeta) => {
            childMeta.setStatusWithChild(isMain)
        })
    }
    setPkgsWithChild() {
        this.childs.forEach((childMeta) => {
            let childPkgs = childMeta.pkgs
            let childRelevanceObjs = childMeta.relevanceObjs
            let childChunkName = childMeta.chunk.name
            for (let pkg of this.pkgs) {
                childPkgs.add(pkg)
                ;(childRelevanceObjs[pkg] = childRelevanceObjs[pkg] || []).push(
                    generateRelevanceObj(pkg + this.chunk.name, "component")
                )
            }
            childMeta.pkgs = unionSet(childMeta.pkgs, this.pkgs)
        })
    }
}
function generateRelevanceObj(name, type = "page") {
    return {
        name,
        type,
    }
}
function isComponent(chunk) {
    let name = chunk.name
    if (!~name.indexOf("common")) {
        let isComponent = true
        for (const chunkGroup of chunk.groupsIterable) {
            isPage = chunkGroup.isInitial()
            if (isPage) {
                isComponent = false
            }
        }
        if (isComponent) return true
    }
    return false
}

function unionSet(setA, setB) {
    let _union = new Set(setA)
    for (let elem of setB) {
        _union.add(elem)
    }
    return _union
}

function replaceJsonFileMap(jsonFileMap, parentName, originName, newName) {
    if (jsonFileMap.has(parentName)) {
        let jsonFile = JSON.parse(jsonFileMap.get(parentName))
        Object.keys(jsonFile.usingComponents).forEach((alias) => {
            if (jsonFile.usingComponents[alias] === `/${originName}`) {
                jsonFile.usingComponents[alias] = `/${newName}`
            }
        })
        jsonFileMap.set(parentName, JSON.stringify(jsonFile))
    }
    //  防止有自己循环自己的情况
    if (jsonFileMap.has(newName)) {
        let jsonFile = JSON.parse(jsonFileMap.get(newName))
        Object.keys(jsonFile.usingComponents).forEach((alias) => {
            if (jsonFile.usingComponents[alias] === `/${originName}`) {
                jsonFile.usingComponents[alias] = `/${newName}`
            }
        })
        jsonFileMap.set(newName, JSON.stringify(jsonFile))
    }
}
const subPackageRoots = Object.keys(process.UNI_SUBPACKAGES).map(
    (root) => root + "/"
)
function isSubpackageComponent(chunk) {
    let name = normalizePath(chunk.name)
    return subPackageRoots.find((root) => name.indexOf(root) === 0)
}

function findModule(modules, resource) {
    return modules.find((module) => {
        let moduleResource = module.resource
        if (
            !moduleResource ||
            (moduleResource.indexOf(".vue") === -1 &&
                moduleResource.indexOf(".nvue") === -1)
        ) {
            return
        }
        moduleResource = removeExt(module.resource)
        return moduleResource === resource
    })
}
function findChunkDeep(pRoot){
    if(pRoot === null) return 0;
    let deepArr = []
    pRoot.parents.forEach(parent => {
        deepArr.push(findChunkDeep(parent))
    });
    if (deepArr.length === 0) {
        deepArr.push(0)
    }
    return Math.max(...deepArr) + 1;
}

function generatePath(name) {
    const modulePath = removeExt(restoreNodeModules(name))
    let resPath = normalizePath(
        path.resolve(process.env.UNI_INPUT_DIR, modulePath)
    )
    return resPath
}

class moveComponentPlugin {
    constructor(dependency) {
        this.uniConfig = {}
        this.movedNames = []
        this.chunkMap = new Map()
        this.chunkUseMap = new Map()
        this.executeQueue = []
    }
    findChunkParent(chunk) {
        // 要建立移动chunk之间的关联
        let pkgs = [],
            relevanceObjs = {},
            originName = chunk.name,
            chunkMap = this.chunkMap
        let meta = chunkMap.get(originName)

        function judgeStatus(group) {
            /**
             *  有以下几种情况
             * 1 组件 => 子包页面
             * 2 组件 => 主包页面
             * 3 组件 => 主包组件 => 主包页面
             * 4 组件 => 主包组件 => 子包页面
             * 5 组件 => 子包组件 => 子包页面
             */
            let name = group.options.name
            let pkg = subPackageRoots.find((root) => name.indexOf(root) === 0)
            let isPage = group.isInitial()
            if (pkg) {
                // 1 5  有分包在引用，不管其他的直接放入
                pkgs.push(pkg)
                ;(relevanceObjs[pkg] = relevanceObjs[pkg] || []).push(
                    generateRelevanceObj(name, isPage ? "page" : "component")
                )
            } else {
                if (isPage) {
                    // 2 有主包的页面在用，不管其他的直接排除这个组件,暂时不把子组件也设为true
                    // 因为有可能关联关系还没有建立，设置也不完整
                    pkgs = []
                    relevanceObjs = {}
                    meta.isMain = true
                } else {
                    // 3 4  有主包的组件在使用，这种情况只能待定,等待父组件确定了才能确定他的情况
                    let parentChunkMeta = chunkMap.get(name)
                    meta.addParent(parentChunkMeta)
                }
            }
        }

        function findPkgs(chunkGroup) {
            if (!chunkGroup) return
            let parentChunkGroups = chunkGroup.getParents()
            for (let i = 0; i < parentChunkGroups.length; i++) {
                judgeStatus(parentChunkGroups[i])
                if (meta.isMain === true) {
                    return
                }
            }
        }
        for (const group of chunk.groupsIterable) {
            let status = findPkgs(group)
            if (meta.isMain === true) {
                return
            }
        }

        pkgs = new Set(pkgs)
        meta.pkgs = pkgs
        meta.relevanceObjs = relevanceObjs
    }

    findUseChunk() {
        // 第一次循环把所有主包在用的组件及其子组件都打标签isMain 为true
        this.executeQueue.forEach(name=>{
            let meta = this.chunkMap.get(name)
            if (meta.isMain) {
                meta.setStatusWithChild(meta.isMain)
            } else {
                meta.setPkgsWithChild()
            }
        })

        // 第二次没有打标签的就是需要迁移到子包的文件
        this.executeQueue.forEach(name=>{
            let meta = this.chunkMap.get(name)
            if (!meta.isMain) {
                this.chunkUseMap.set(name, meta)
            }
        })
        this.sortQueue(this.chunkUseMap)
    }
    updateJsonFileMap(relevance, originName, newName) {
        var { jsonFileMap } = this.uniConfig
        // 根据父组件是否也要迁移分2种情况
        let parentName = relevance.name
        if (this.chunkUseMap.has(parentName)) {
            let parentChunkMeta = this.chunkUseMap.get(parentName)
            // 根据父组件是否迁移完成分2种情况
            if (parentChunkMeta.moveNames.size > 0) {
                for (let moveName of parentChunkMeta.moveNames) {
                    replaceJsonFileMap(
                        jsonFileMap,
                        moveName,
                        originName,
                        newName
                    )
                }
            } else {
                replaceJsonFileMap(jsonFileMap, parentName, originName, newName)
            }
        } else {
            replaceJsonFileMap(jsonFileMap, parentName, originName, newName)
        }
    }
    sortQueue(chunkMap){
        let arr = []
        for (let key of chunkMap.keys()) {
            arr.push(key)
        }
        this.executeQueue = arr.sort((a,b)=>{
            return chunkMap.get(a).deep - chunkMap.get(b).deep
        })
    }
    getUniConfig() {
        this.uniConfig["componentSet"] = getComponentSet()
        this.uniConfig["pageSet"] = getPageSet()
        this.uniConfig["jsonFileMap"] = getJsonFileMap()
    }
    findReplaceModule(modules, name) {
        let resource = generatePath(name)
        let mainModule = findModule(modules, resource)
        if (!mainModule) {
            throw new Error("编译失败：找不到迁移组件")
        }
        return mainModule
    }
    moveComponent(chunk, meta) {
        
        // 迁移js wxss
        let pkgArr = Array.from(meta.pkgs)
        let pkgName = pkgArr[0],
            relevanceObj = meta.relevanceObjs[pkgArr[0]]
        let originName = chunk.name
        let newName = pkgName + chunk.name
        var { componentSet, jsonFileMap } = this.uniConfig
        // 分包目录下与待待迁移组件路径与文件相同
        if (jsonFileMap.has(newName)) {
            console.log(`分包已经存在${newName}，请考虑直接引用该文件`)
            newName = pkgName + 'mainComponents/' + chunk.name
        }
        chunk.name = newName
        // 组件的主要module
        let mainModule = this.findReplaceModule(
            Array.from(chunk.modulesIterable),
            originName
        )
        // 更改后的组件路径
        let newPath = generatePath(newName)

        this.movedNames.push({
            oldName: originName,
            newName: newName,
            mainModule,
            replaceReg: new RegExp(newPath),
        })
        meta.moveNames.add(newName)
        // 修改相关的所有json配置
        
        if (componentSet.has(originName)) {
            componentSet.delete(originName)
            componentSet.add(newName)
        }
        if (jsonFileMap.has(originName)) {
            let jsonFile = jsonFileMap.get(originName)
            jsonFileMap.delete(originName)
            updateComponentJson(originName, {})
            updateComponentJson(newName, JSON.parse(jsonFile))
        }
        relevanceObj.forEach((relevance) => {
            this.updateJsonFileMap(relevance, originName, newName)
        })
    }
    copyComponent(chunk, meta, compilation) {
        let { pkgs, relevanceObjs } = meta
        let originName = chunk.name
        // 组件的主要module
        let mainModule = this.findReplaceModule(
            Array.from(chunk.modulesIterable),
            originName
        )
        var { componentSet, jsonFileMap } = this.uniConfig
        if (componentSet.has(originName)) {
            componentSet.delete(originName)
        }
        pkgs.forEach((pkgName) => {
            let newChunk = this.createIdenticalChunk(
                pkgName,
                chunk,
                compilation
            )
            let newName = newChunk.name
            this.movedNames.push({
                oldName: originName,
                newName,
                mainModule,
                replaceReg: new RegExp(generatePath(newName)),
            })
            meta.moveNames.add(newName)
            componentSet.add(newName)
            if (jsonFileMap.has(originName)) {
                let jsonFile = jsonFileMap.get(originName)
                updateComponentJson(newName, JSON.parse(jsonFile))
            }
            relevanceObjs[pkgName].forEach((relevance) => {
                this.updateJsonFileMap(relevance, originName, newName)
            })
        })

        if (jsonFileMap.has(originName)) {
            jsonFileMap.delete(originName)
            updateComponentJson(originName, {})
        }

        chunk.remove("has copyed to subpackages")
    }
    createIdenticalChunk(pkgName, oldChunk, compilation) {
        var { jsonFileMap } = this.uniConfig
        let chunkName = pkgName + oldChunk.name
          // 分包目录下与待待迁移组件路径与文件相同
          if (jsonFileMap.has(chunkName)) {
            console.log(`分包已经存在${chunkName}，请考虑直接引用该文件`)
            chunkName = pkgName + 'mainComponents/' + oldChunk.name
        }
        let newChunkGroup = compilation.addChunkInGroup(chunkName)
        let newChunk = newChunkGroup.chunks[0]
        newChunk.chunkReason = `for copy ${oldChunk.name} to subPackage`

        for (const group of oldChunk.groupsIterable) {
            //  关联chunk和所有module
            for (const module of oldChunk.modulesIterable) {
                GraphHelpers.connectChunkAndModule(newChunk, module)
                // for mini-css-extract-plugin
                newChunkGroup.setModuleIndex(module,group.getModuleIndex(module))
                newChunkGroup.setModuleIndex2(module,group.getModuleIndex2(module))
            }

            // 关联chunk和相关分包的block
            for (const block of group.blocksIterable) {
                if (block.module) {
                    let resource = block.module.resource
                    if (normalizePath(resource).indexOf(pkgName) > -1) {
                        block.chunkGroup = newChunkGroup
                    }
                }
            }
            // 关联chunkgroup和相关的父子group
            for (const childGroup of group.childrenIterable) {
                let name = childGroup.options.name
                if (name.indexOf(pkgName) > -1) {
                    GraphHelpers.connectChunkGroupParentAndChild(
                        newChunkGroup,
                        childGroup
                    );
                    group.removeChild(childGroup)
                }
            }
            for (const parentGroup of group.parentsIterable) {
                let name = parentGroup.options.name
                if (name.indexOf(pkgName) > -1) {
                    GraphHelpers.connectChunkGroupParentAndChild(
                        parentGroup,
                        newChunkGroup
                    );
                    group.removeParent(parentGroup)
                }
            }
        }

        return newChunk
    }
    bulidChunkGraph(chunks) {
        // 第一次遍历给每个chunk生成一个meta
        // for (let index = chunks.length-1; index >= 0; index--) {
        //     const chunk = chunks[index];
        //     let meta = new chunkMeta(chunk)
        //     let name = chunk.name
        //     this.chunkMap.set(name, meta)
        // }
        chunks.forEach((chunk) => {
            let meta = new chunkMeta(chunk)
            let name = chunk.name
            this.chunkMap.set(name, meta)
        })
        // 第二次遍历建立chunk之间的关联
        chunks.forEach((chunk) => {
            this.findChunkParent(chunk)
        })
        // 第三次遍历获取每个chunk的深度
        chunks.forEach((chunk) => {
            let meta = this.chunkMap.get(chunk.name)
            meta.deep = findChunkDeep(meta)
        })
        // 获取执行顺序
        this.sortQueue(this.chunkMap)

        this.findUseChunk()
    }
    apply(compiler) {
        compiler.hooks.thisCompilation.tap("moveComponentPlugin", (compilation) => {
            compilation.hooks.optimizeChunks.tap("moveComponentPlugin", (chunks) => {
                //  找到所有组件

                let componentChunk = chunks.filter((e) => isComponent(e))

                // 找到所有非分包的组件
                let subpackageComponentChunk = componentChunk.filter(
                    (e) => !isSubpackageComponent(e)
                )
                // 找到所有分包在用没有主包在用的组件
                if (subpackageComponentChunk.length > 0) {
                    this.getUniConfig()
                    this.bulidChunkGraph(subpackageComponentChunk)
                    this.executeQueue.forEach(name=>{
                        let meta = this.chunkUseMap.get(name)
                        let { pkgs } = meta
                        console.log(
                            `迁移主包组件${name} 至 ${Array.from(pkgs).join(',')}分包内`
                        )
                        if (pkgs.size > 1) {
                            // 多个分包在用则要新建chunk
                            this.copyComponent(meta.chunk, meta, compilation)
                        } else if (pkgs.size > 0) {
                            // 只有一个分包在用的情况，直接把chunk移动到分包
                            this.moveComponent(meta.chunk, meta)
                        }
                    })
                }
                if (!hasEmit) {
                    hasEmit = true
                    compiler.hooks.emit.tapPromise(
                        "moveComponentPlugin",
                        (compilation) => {
                            const assets = compilation.assets
                            let movedNames = this.movedNames
                            let wxmlDelSet = new Set()
                            this.movedNames.forEach(
                                ({
                                    oldName,
                                    newName,
                                    mainModule,
                                    replaceReg,
                                }) => {

                                    if (assets[oldName + ".js"]) {
                                        delete assets[oldName + ".js"]
                                    }
                                    if (assets[newName + ".js"]) {
                                        let source =
                                            assets[newName + ".js"].source()
                                        source = source.replace(
                                            replaceReg,
                                            mainModule.id
                                        )
                                        const newSource = function () {
                                            return source
                                        }
                                        newSource.__$wrappered = true
                                        assets[newName + ".js"].source =
                                            newSource
                                    }
                                    if (assets[oldName + ".json"]) {
                                        delete assets[oldName + ".json"]
                                    }
                                    if (assets[oldName + ".wxml"]) {
                                        assets[newName + ".wxml"] =
                                            assets[oldName + ".wxml"]
                                        wxmlDelSet.add(oldName)
                                    }
                                }
                            )
                            for (var oldName of wxmlDelSet) {
                                if (assets[oldName + ".wxml"]) {
                                    delete assets[oldName + ".wxml"]
                                }
                            }
                            return Promise.resolve()
                        }
                    )
                }
            })
        })
    }
}
module.exports = moveComponentPlugin
