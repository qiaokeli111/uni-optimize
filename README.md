# uni-optimize

## 安装
```
npm install -D uni-optimize
```

### 说明

该库是针对uni打包微信小程序的各方面优化插件集合，建议根据需求选择部分插件安装

<font color=#A52A2A size=4 >vue和js的分包插件目前只能在生产模式使用!!!</font>
<font color=#A52A2A size=4 >js的分包插件需要开启manifest.json中的以下配置"optimization":{"subPackages":true}</font>

### 所有插件使用方式
```
// vue.config.js中直接引入
var uniOptimize = require('uni-optimize');
module.exports = {
    chainWebpack: config => {
        uniOptimize(config)
    },
}
```

### 部分插件使用
```
// vue.config.js中直接引入
var minicss = require('uni-optimize/fix-mini-css-plugin');
module.exports = {
    chainWebpack: config => {
        config.plugin('minicss').use(minicss)
    },
}
```

### 各个插件介绍
[fix-mini-css-plugin](https://www.cnblogs.com/wzcsqaws/p/15860928.html)<br/>
[fix-ensure-import-plugin](https://www.cnblogs.com/wzcsqaws/p/15866181.html)<br/>
[transfer-js-plugin](https://www.cnblogs.com/wzcsqaws/p/15866482.html)<br/>
[transfer-vue-plugin](https://www.cnblogs.com/wzcsqaws/p/15866482.html)<br/>
[transfer-vue-plugin](https://www.cnblogs.com/wzcsqaws/p/16385254.html)
