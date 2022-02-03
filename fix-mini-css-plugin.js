/* eslint-disable */
class fixMiniCssPlugin {
    constructor() {}
    apply(compiler) {
        compiler.hooks.thisCompilation.tap('remo', compilation => {
            const {
                mainTemplate
            } = compilation;
            mainTemplate.hooks.localVars.intercept({
                register: (tapInfo) => {
                    if (tapInfo.name === 'mini-css-extract-plugin') {
                        tapInfo.fn = function (params) {};
                    }
                    return tapInfo;
                }
            });
            mainTemplate.hooks.requireEnsure.intercept({
                register: (tapInfo) => {
                    if (tapInfo.name === 'mini-css-extract-plugin') {
                        tapInfo.fn = function (params) {};
                    }
                    return tapInfo;
                }
            });
        });
    }
}
module.exports = fixMiniCssPlugin;
