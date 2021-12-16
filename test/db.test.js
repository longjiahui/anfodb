const path = require('path')
const assert = require('assert')
const Validator = require('@anfo/validator')
const v = (...rest)=>new Validator().v(...rest)

const puppeteer = require('puppeteer')
const { createServer } = require('vite')

const utils = require('./scripts/utils')

let server
let browser
before(async function(){
    this.timeout(10000)
    server = await createServer({
        root: path.resolve(__dirname, '../debug'),
    })
    await server.listen()
    server.port = server?.config?.server?.port
    browser = await puppeteer.launch()
})
after(async ()=>{
    await browser?.close?.()
    await server?.close?.()
})
let page
beforeEach(async function(){
    this.timeout(100000)
    pages = await browser.pages()
    page = pages?.[0] || await browser.newPage()
    await page.goto(`http://localhost:${server.port}`)
})
afterEach(async function(){
    this.timeout(5000)
    await utils.evaluate(page, async ()=>{
        // delete all databases
        let dbs = await indexedDB.databases()
        let names = dbs.map(db=>db.name)
        dbs = null
        await Promise.all(names.map(
            name=>new Promise((r, reject)=>{
                let req = indexedDB.deleteDatabase(name)
                req.onerror = reject
                req.onsuccess = r
            }).catch(err=>console.error(err))
        ))
    })
    await page.close()
})

describe('indexedDB lib', async ()=>{
    describe('regular use', async()=>{
        it('no configs', async ()=>{
            let { ret, msgs, db, hasError } = await utils.evaluate(page, ()=>{
                let db = new DB()
            })
            assert(hasError && db.find(i=>i.type === 'error')?.errno === '-100', '没提供合适配置，没输出对应报错')
        })

        it('put get', async ()=>{
            let { ret } = await utils.evaluate(page, async ()=>{
                let db = await (new DB({
                    db: 'test',
                    stores: {
                        test: {
                            keyPath: 'id',
                            indexes: [
                                ['name', 'name']
                            ]
                        }
                    }
                }).init())
                await db.store('test').put({
                    id: 1,
                    name: 'hello',
                    content: 'world',
                })
                return await db.store('test').get(1)
            }, {debug: true})
            assert(await v(ret, {
                id: 1,
                name: '=hello',
                content: '=world'
            }), '执行返回错误')
        })

        it('index get', async ()=>{
            let { ret } = await utils.evaluate(page, async ()=>{
                let db = await(new DB({
                    db: 'test',
                    stores: {
                        test: {
                            keyPath: 'id',
                            indexes: [
                                ['name', 'name']
                            ]
                        }
                    }
                }).init())
                await db.store('test').put({
                    id: 1,
                    name: 'hello',
                    content: 'world',
                })
                return await db.store('test').index('name').get('hello')
            })
            assert(await v(ret, {
                id: 1,
                name: '=hello',
                content: '=world'
            }), '执行返回错误')
        })

        it('add index get', async ()=>{
            let { ret } = await utils.evaluate(page, async ()=>{
                let db = await(new DB({
                    db: 'test',
                    stores: {
                        test: {
                            keyPath: 'id',
                            indexes: [
                                ['name', 'name']
                            ]
                        }
                    }
                }).init())
                await db.store('test').add({
                    id: 1,
                    name: 'hello',
                    content: 'world',
                })
                return await db.store('test').index('name').get('hello')
            })
            assert(await v(ret, {
                id: 1,
                name: '=hello',
                content: '=world'
            }), '执行返回错误')
        })

        it('put openCursor index', async ()=>{
            let { ret } = await utils.evaluate(page, async ()=>{
                let db = await(new DB({
                    db: 'test',
                    stores: {
                        test: {
                            keyPath: 'id',
                            indexes: [
                                ['name', 'name']
                            ]
                        }
                    }
                }).init())
                await db.store('test').put({
                    id: 1,
                    name: 'hello',
                    content: 'world',
                })
                await db.store('test').put({
                    id: 2,
                    name: 'hello',
                    content: 'world2',
                })
                await db.store('test').put({
                    id: 3,
                    name: 'hello2',
                    content: 'world3',
                })
                return await db.store('test').index('name').openCursor(()=>true, IDBKeyRange.only('hello'))
            })
            assert(await v(ret, {
                $: 'array',
                $subItem: {
                    id: '=1 || =2',
                    name: '=hello',
                    content: '=world || =world2'
                }
            }), '执行返回错误')
        })
    })

    describe('db version change', async ()=>{
        it('add store', async()=>{
            let { ret, msgs } = await utils.evaluate(page, async()=>{
                let db = await(new DB({
                    db: 'test',
                    debug: 'debug',
                    stores: {}
                }).init())

                db = await(new DB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                        test: {
                            keyPath: 'id'
                        }
                    }
                }).init())
                console.time('hello')
                let ret = (await db.objectStoreNames()).includes('test')
                console.timeEnd('hello')
                return ret
            })
            assert(v(ret, true), 'add store failed')
        })

        it('delete store', async()=>{
            let { ret } = await utils.evaluate(page, async()=>{
                let db = await(new DB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                        test: {
                            keyPath: 'id'
                        }
                    }
                }).init())
                
                db = await(new DB({
                    db: 'test',
                    debug: 'debug',
                    stores: {}
                }).init())

                return !(await db.objectStoreNames()).includes('test')
            })
            assert(v(ret, true), 'add store failed')
        })

        it('reject upgrade', async()=>{
            let { ret } = await utils.evaluate(page, async()=>{
                let db = await(new DB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                        test: {
                            keyPath: 'id'
                        }
                    }
                }).init())
                
                await (new DB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                    },
                    upgradePromise: Promise.reject(),
                }).init())
            })
        })

        it('resolve upgrade', async()=>{
            let { ret } = await utils.evaluate(page, async()=>{
                let db = await(new DB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                        test: {
                            keyPath: 'id'
                        }
                    }
                }).init())
                
                await (new DB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                    },
                    upgradePromise: Promise.resolve(),
                }).init())
            })
        })

    })
})