
/* eslint-disable */
const parser = require('@babel/parser');
const t = require('@babel/types');
const babelTraverse = require('@babel/traverse').default;
const babelGenerate = require('@babel/generator').default;
const { getJsonFileMap } = require('@dcloudio/uni-cli-shared/lib/cache');

function getComponentName (comments) {
    const names = [];
    comments.filter(str=>str.value.indexOf('require.ensure')>0).forEach(comment => {
        const originValue = comment.value;
        names.push(originValue.replace(/\s/g, '').split('|')[1]);
    });
    return names;
}

// 验证函数体是否是可以删除的
function validIsDel (functionPath) {
    // var aa = function aa() {
    //     __webpack_require__.e(/*! require.ensure | pages/index/hh */ "pages/index/hh").then((function () {
    //       return resolve(__webpack_require__(/*! ./hh */ "0ff0"));
    //     }).bind(null, __webpack_require__)).catch(__webpack_require__.oe);
    //   };
    if (!t.isFunctionExpression(functionPath)) return false
    // 验证函数名称和赋值名称是否相同
    let functionName = functionPath.node.id.name
    let variableName = functionPath.parentPath.node.id.name
    if (functionName !== variableName) return false
    // 验证catch函数是否是__webpack_require__.oe
    let isDel = false
    functionPath.traverse({
        MemberExpression(catchePath) {
            if (catchePath.node.property && catchePath.node.property.name === 'oe' && catchePath.node.object && catchePath.node.object.name === '__webpack_require__') {
                isDel = true
            }
        },
      });
      return isDel
}

class ensurePlugin {
    constructor () {}

    apply (compiler) {
        compiler.hooks.compilation.tap('ensurePlugin', compilation => {
            compilation.hooks.optimizeChunkAssets.tapAsync(
                'ensurePlugin',
                (chunks, callback) => {
                    const jsonFileMap = getJsonFileMap();
                    Array.from(chunks)
                        .filter(chunk =>
                        // 要过滤掉不是vue的组件
                            jsonFileMap.get(chunk.id))
                        .reduce((acc, chunk) => acc.concat(chunk.files || []), [])
                        .filter(filename => filename.indexOf('.js') > 0)
                        .forEach(file => {
                            if (compilation.assets[file]) {
                                let origSource = compilation.assets[file].source();
                                // origSource = `var UserPage = function UserPage() {
                                //     Promise.all(/*! require.ensure | pages/me/components/UserPage */[__webpack_require__.e("common/vendor"), __webpack_require__.e("pages/me/components/UserPage")]).then((function () {
                                //       return resolve(__webpack_require__(/*! ./components/UserPage.vue */ 1979));
                                //     }).bind(null, __webpack_require__)).catch(__webpack_require__.oe);
                                //   };`
                                const sourceAst = parser.parse(origSource);
                                const componentsName = getComponentName(sourceAst.comments);
                               
                                babelTraverse(sourceAst, {
                                    StringLiteral (path) {
                                        const { value } = path.node;
                                        if (componentsName.some(name => name === value)) {
                                            const functionPath = path.findParent(path => path.isFunctionExpression());
                                            if (validIsDel(functionPath)) {
                                                functionPath.replaceWith(t.numericLiteral(0));
                                            }
                                        }
                                    }
                                });
                                const parseCode = babelGenerate(sourceAst).code;
                                const newSource = function () {
                                    return parseCode;
                                };
                                compilation.assets[file].source = newSource;
                            }
                        });
                    callback();
                }
            );
        });
    }
}
module.exports = ensurePlugin;