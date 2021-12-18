# @anfo/db [NPM](https://www.npmjs.com/package/@anfo/db)

## Features

- 隐藏版本相关操作
- 使用接近原indexedDB的api风格
- 使用Promise风格返回，更容易使用

## 使用方法

### 引入

```javascript
import AnfoDB from '@anfo/db'
```

```html
<script src="db.js"></script>
```

### 使用
```javascript
import AnfoDB from '@anfo/db'

let config = {
    // db name
    db: 'anfo',
    /* 
    日志等级
        warn: 显示warn、error日志
        debug: 显示所有日志
        error: 只显示error日志
    */
    debug: 'warn',
    /*
    判断当前选择数据库的objectStores的配置，包含对索引，索引属性进行检查，
    比对后发现与当前该config配置存在不同处会触发升级，如果是修改schemas的
    操作将会删除原来的objectStore，这个时候通过这里返回一个Promise，reject
    的情况表示不同意升级，将不会根据当前config执行更新ObjectStore的操作，
    而如果返回Resolve则会对数据库进行升级，删除原来的数据库并创建新的与配置
    一致的数据库

    所以这里的Promise可以使用confirm dialog询问用户意见，是否重新创建新的
    数据库，或者在此Promise对原数据进行一个缓存，新建后重新插入新的表中。
    */
    upgradePromise: ()=>Promise.reject(),
    stores: {
        // object store name
        user: {
            // object store attributes
            keyPath: 'id',
            autoIncrement: false,

            // 索引
            indexes: [
                // name, keyPath, parameteres
                ['name', 'name', {
                    // unique: false,
                    // multiEntry: false,
                    // locale: '',
                }]
            ]
        }
    }
}

let db = new AnfoDB(config)

// init会执行检查config与实际表异常的逻辑并据此判断是否需要进行升级
db.init().then(()=>{
    // 初始化成功，用户拒绝升级也会在这里
}).catch(err=>{
    // 初始化失败
})
```

### API

- Anfo.prototype.transaction(storeNames: Array, 'readonly' | 'readwrite') : Transaction
- Transaction.prototype.store(storeName: String) : Store
- Transaction.prototype.do() : Promise
- Transaction.prototype.doOne() : Promise

下面的接口与原indexedDB的接口是一致的，但是下面的接口都不会真正执行操作，会等待Transaction执行do、doOne的时候开始执行。返回的Promise也会再执行do、doOne的时候被Resolve/Reject，所以需要注意的是**在执行Transaction.prototype.do / Transaction.prototype.doOne前不要使用await等待下面操作返回的Promise，会陷入永无止境的等待中。**

- Store.prototype.add : Promise
- Store.prototype.put : Promise
- Store.prototype.get : Promise
- Store.prototype.count : Promise
- Store.prototype.getAll : Promise
- Store.prototype.delete : Promise
- Store.prototype.clear : Promise
- Store.prototype.index(indexName: String) : Store

openCursor的接口做了一些修改，当cursorHandler返回True时会继续遍历后面符合条件的数据，否则会停止遍历，返回的Promise会包含遍历过的所有数据。

- Store.prototype.openCursor(cursorHandler: Function, keyRange: IDBKeyRange) : Promise

下面是一些快速单表操作的API，与上面的不同就是上面的连续操作是在事务中进行的，下面的每一个操作都是一个单独的事务。

- AnfoDB.prototype.store(storeName: String) : QuickStore
- QuickStore.prototype.add : Promise
- QuickStore.prototype.put: Promise
- QuickStore.prototype.get : Promise
- QuickStore.prototype.count : Promise
- QuickStore.prototype.getAll : Promise
- QuickStore.prototype.delete : Promise
- QuickStore.prototype.clear : Promise
- QuickStore.prototype.index(indexName: String) : QuickStore
- QuickStore.prototype.openCursor(cursorHandler: Function, keyRange: IDBKeyRange) : Promise

```javascript
let db = new DB(config)

let t = db.transaction(['user'], 'readwrite')
let s = t.store('user')
s.index('name').get('Anfo')
s.index('name').get('Bnfo')
t.do.then(data=>{
    // Array 顺序返回所有store操作的结果
    console.log(data)
})
/*
t.doOne 会返回t.do的第一个结果，快速store操作就是doOne的语法糖
*/
```

```javascript
let db = new DB(config)
db.store('user').index('name').get('Anfo').then(data=>{
    console.log(data)
})
```

更多的例子可以参考`test/db.test.js`中的用例