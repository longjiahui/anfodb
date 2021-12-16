import shortid from 'shortid'

// config格式
/*
{
    db: String dbName,
    debug: String debugLevel 'debug','error', 'warn',
    stores: {
        [storeName]: {
            keyPath: String keypath,
            autoIncrement: Boolean autoIncrement,
            indexes: [
                [indexName, keyPath, {
                    unique: Boolean unique,
                    multiEntry: Boolean multiEntry,
                    locale: String locale
                }]
            ]
        }
    },
    upgradePromise: Function:Promise / Promise 表示同意升级，会删除原有的数据，可以在这里弹出confirm框体或进行一些数据升级操作
}
*/

// index 会特殊处理
let cmds = ['add', 'put', 'get', 'count', 'getAll', 'openCursor', 'delete', 'clear']
let toCMDFuncs = func=>cmds.reduce((t, cmd, i)=>{
    t[cmd] = func(cmd)
    return t
}, {})

const ERR_CONFIG = -100     // 配置错误
const ERR_UPGRADE = -101    // 升级失败
export default class DB{

    debug(...rest){
        if(['debug'].includes(this.config?.debug)){
            console.debug(`[db][${Date.now()}]`, ...rest)
        }
    }
    error(errno, ...rest){
        console.error(`[db][${Date.now()}][errno: ${errno}]`, ...rest)
    }
    warn(...rest){
        if(['warn', 'debug'].includes(this.config?.debug)){
            console.warn(`[db][${Date.now()}]`, ...rest)
        }
    }

    // async open(){
    //     return DB._openDB(this.config.db).then(db=>{
    //         // 检查当前版本是否与配置不符，如果不符则创建新的版本
    //         let difference = this._getDifferenceWithCurrentConfig(db)
    //         this.debug(`检查配置发现配置修改: `, difference)
    //         if(difference.length > 0){
    //             // 有不同，确定是否需要升级同意问询
    //             let isNeedUpdatePromise = false
    //             for(let diffItem of difference){
    //                 if(/^modify/.test(diffItem.type)){
    //                     // needUpgrade
    //                     isNeedUpdatePromise = true
    //                     break
    //                 }
    //             }
    //             let p = Promise.resolve()
    //             if(isNeedUpdatePromise){
    //                 // upgradePromise
    //                 p = this._getUpgradePromise()
    //             }
    //             return new Promise((r, reject)=>{
    //                 p.then(()=>{
    //                     let version = db.version
    //                     this.debug(`同意升级，开始升级(currentVersion: ${version})`)
    //                     db.close()
    //                     let req = indexedDB.open(this.config.db, ++version)
    //                     req.onerror = reject
    //                     req.onsuccess = ()=>{
    //                         this.warn('发现配置与当前数据库不一致，且升级失败')
    //                         r(req.result)
    //                     }
    //                     req.onupgradeneeded = e=>{
    //                         let db = e.target.result
    //                         difference.forEach(d=>{
    //                             this.doDiffItem(db, d)
    //                         })
    //                         r(db)
    //                     }
    //                 }).catch(err=>{
    //                     this.error(ERR_UPGRADE, '升级失败: ', err)
    //                     reject(err)
    //                 })
    //                 p.catch(err=>{
    //                     this.warn('不同意升级: ',err)
    //                     r(db)
    //                 })
    //             })
    //         }else{
    //             // 无不同，返回
    //             return db
    //         }
    //     })
    // }
    async open(){
        return DB._openDB(this.config.db)
    }

    constructor(config){
        if(!config || !config.db || !config.stores){
            this.error(ERR_CONFIG, 'indexeddb 初始化失败，请提供合适的配置: ', config)
            return
        }
        this.config = config
        // 检查数据库与config差异只在constructor中做
        // this.open().then(db=>{
        //     db.close()
        // })
    }

    async init(){
        return DB._openDB(this.config.db).then(db=>{
            // 检查当前版本是否与配置不符，如果不符则创建新的版本
            let difference = this._getDifferenceWithCurrentConfig(db)
            this.debug(`检查配置发现配置修改(amount: ${difference?.length || 0}): `, difference)
            if(difference.length > 0){
                // 有不同，确定是否需要升级同意问询
                let isNeedUpdatePromise = false
                for(let diffItem of difference){
                    if(/^modify/.test(diffItem.type)){
                        // needUpgrade
                        isNeedUpdatePromise = true
                        break
                    }
                }
                let p = Promise.resolve()
                if(isNeedUpdatePromise){
                    // upgradePromise
                    p = this._getUpgradePromise()
                }
                p.then(()=>{
                    return new Promise((r, reject)=>{
                        let version = db.version
                        this.debug(`同意升级，开始升级(currentVersion: ${version})`)
                        db.close()
                        let req = indexedDB.open(this.config.db, ++version)
                        req.onerror = reject
                        // onsuccess 和onupgradeneeded会同时触发
                        // req.onsuccess = e=>{
                        //     this.warn(`发现配置与当前数据库不一致，且升级失败(currentVersion: ${version})`)
                        //     // new Db
                        //     db = e.target.result
                        // }
                        req.onupgradeneeded = e=>{
                            // new db
                            db = e.target.result
                            difference.forEach(d=>{
                                this.doDiffItem(db, d)
                            })
                            r()
                        }
                    })
                }).catch(err=>{
                    this.error(ERR_UPGRADE, '升级失败: ', err)
                    throw err
                })
                p.catch(err=>{
                    this.warn('不同意升级: ',err)
                })
                return p.finally(()=>{
                    db.close()
                })
            }
        }).then(()=>{
            this._isInited = true
            this.debug('数据库初始化成功')
            return this
        }).catch(err=>{
            this._isInited = false
            this.error('数据库初始化失败: ', err)
            throw err
        })
    }

    static async _openDB(db, version){
        return new Promise((r, reject)=>{
            let req = indexedDB.open(db, version)
            req.onerror = reject
            req.onsuccess = ()=>r(req.result)
            req.onupgradeneeded = e=>r(e.target.result)
        })
    }

    async objectStoreNames(){
        console.time('open')
        let db = await this.open()
        console.timeEnd('open')
        console.time('names')
        let names = db.objectStoreNames
        console.timeEnd('names')
        console.time('close')
        db.close()
        console.timeEnd('close')
        return [...names]
    }

    _getUpgradePromise(){
        let p = this.config?.upgradePromise
        if(p instanceof Function){
            return p(this)
        }else if(p instanceof Promise){
            return p
        }else{
            return Promise.resolve()
        }
    }

    doDiffItem(db, {type, data, config} = {}){
        let createStore = ()=>{
            let store = db.createObjectStore(data, DB._getStoreCreateConfig(config))
            config.indexes?.forEach(i=>{
                store.createIndex(...i)
            })
        }
        if(type === 'modifyStore'){
            // 暂时忽略数据转移
            db.deleteObjectStore(data)
            createStore()
        }else if(type === 'addStore'){
            createStore()
        }else if(type === 'deleteStore'){
            db.deleteObjectStore(data)
        }
    }

    static _getStoreCreateConfig(config){
        let c = {...config}
        delete c.indexes
        return c
    }

    _getDifferenceWithCurrentConfig(db){
        let storesConfig = this.config?.stores
        let names = Object.keys(storesConfig)
        let difference = []
        // 反向查找需要删除的
        ;[...db.objectStoreNames].forEach(name=>{
            if(!names.includes(name)){
                difference.push({
                    type: 'deleteStore',
                    data: name
                })
            }
        })
        names.forEach(name=>{
            let config = storesConfig?.[name]
            if(config){
                // 对比是否存在
                if(!db.objectStoreNames.contains(name)){
                    // 不存在
                    // addStore
                    difference.push({
                        type: 'addStore',
                        data: name,
                        config,
                    })
                }else{
                    // 对比
                    // object options
                    // keyPath, autoIncrement
                    let t = db.transaction([name], 'readonly')
                    let store = t.objectStore(name)
                    let storeCreateConfig = DB._getStoreCreateConfig(config)
                    if((storeCreateConfig?.keyPath||'') !== (store.keyPath||'') ||
                        !!storeCreateConfig?.autoIncrement !== !!store.autoIncrement){
                        // modify store schemas
                        difference.push({
                            type: 'modifyStore',
                            data: name,
                            config,
                        })
                    }else{
                        // indexes
                        let indexesConfig = config.indexes
                        indexesConfig?.forEach(indexConfig=>{
                            let [indexName, keyPath, parameters] = indexConfig
                            if(!store.indexNames.contains(indexName)){
                                difference.push({
                                    type: 'modifyStore',
                                    data: name,
                                    config,
                                })
                            }else{
                                let index = store.index(indexName)
                                if(keyPath !== index.keyPath ||
                                    // 默认值 multiEntry: false, unique: false, locale: '' 
                                    !!parameters?.multiEntry !== index.multiEntry ||
                                    !!parameters?.unique !== index.unique ||
                                    (parameters?.locale || '') !== (index.locale || '')){
                                    difference.push({
                                        type: 'modifyStore',
                                        data: {
                                            store: name,
                                            index: indexName,
                                        },
                                        config,
                                    })
                                }
                            }
                        })
                    }
                }
            }
        })
        return difference
    }

    // async transaction(names, ...rest){
    //     let db = await this.open()
    //     await this.ensureStores(names, db)
    //     return db.transaction(names, ...rest)
    // }
    
    
    transaction(names, ...rest){
        let ops = []
        let promiseOps = {}
        let promises = {}
        let i = 0
        let storeFuncs = ({index, name})=>{
            let funcs = {
                op: (cmd, ...rest)=>{
                    let id = shortid.generate()
                    ops.push({
                        id,
                        cmd,
                        stores: names,
                        store: name,
                        index,
                        data: rest,
                    })
                    promises[id] = new Promise((r, reject)=>{
                        promiseOps[id] = {
                            r,
                            reject,
                            i: i++,
                        }
                    })
                    return promises[id]
                },
                ...toCMDFuncs(cmd=>(...rest)=>funcs.op(cmd, ...rest)),
                index: indexName=>{
                    return storeFuncs({index: indexName, name})
                },
            }
            return funcs
        }
        let transactionFuncs = {
            store: name=>storeFuncs({name}),
            do: async ()=>{
                let db = await this.open()
                let transaction = db.transaction(names, ...rest)
                ops.forEach(op=>{
                    let { id } = op
                    let p = this.doOp(op, transaction)
                    p.then(promiseOps[id].r).catch(promiseOps[id])
                    promises[id] = p
                })
                return new Promise((r, reject)=>{
                    transaction.onerror = reject
                    transaction.oncomplete = async e=>{
                        this.debug('transaction complete: ', e)
                        let res = (await Promise.all(Object.values(promises).sort((a, b)=>a.i - b.i))) || []
                        r(res)
                    }
                    transaction.onabort = reject
                }).finally(()=>{
                    db.close()
                    ops = []
                    promises = {}
                    promiseOps = {}
                    i = 0
                })
            },
            doOne(...rest){
                return transactionFuncs.do(...rest).then(res=>res?.[0])
            }
        }
        return transactionFuncs
    }

    async doOp({id, cmd, stores, store: storeName, index, data} = {}, transaction){
        return new Promise((r, reject)=>{
            if(!id || !cmd || !stores || !storeName){
                reject(`需要的参数提供不全，可能是调用顺序出错(id, cmd, stores, store): ${id}, ${cmd}, ${stores}, ${store}`)
                return
            }
            let store = transaction.objectStore(storeName)
            if(index){
                store = store.index(index)
            }
            let req
            if(cmd === 'openCursor'){
                let idbKeyRange = data?.[1]
                if(idbKeyRange){
                    req = store.openCursor(idbKeyRange)
                }else{
                    req = store.openCursor()
                }
                req.onerror = reject
                let datas = []
                req.onsuccess = e=>{
                    let cursor = e.target.result
                    if(!cursor){
                        r(datas)
                        return
                    }
                    datas.push(cursor.value)
                    let handler = data?.[0]
                    let res = handler?.(cursor)
                    if(res){
                        cursor.continue()
                    }else{
                        r(datas)
                    }
                }
            }else{
                req = store[cmd]?.(...data)
                req.onerror = reject
                req.onsuccess = e=>r(e.target.result)
            }
        })
    }

    store(name){
        let funcs = indexName=>({
            op: (...rest)=>{
                let t = this.transaction([name], 'readwrite')
                let s = t.store(name)
                if(indexName){
                    s.index(indexName).op(...rest)
                }else{
                    s.op(...rest)
                }
                return t.doOne()
            },
            index: i=>funcs(i),
            ...toCMDFuncs(cmd=>(...rest)=>funcs(indexName).op(cmd, ...rest)),
            // add: (...rest)=>funcs.op('add', ...rest),
            // put: (...rest)=>funcs.op('put', ...rest),
            // get: (...rest)=>funcs.op('get', ...rest),
            // count: (...rest)=>funcs.op('count', ...rest),
        })
        return funcs()
    }
}