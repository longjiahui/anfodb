const path = require('path')
const assert = require('assert')
const Validator = require('@anfo/validator')
const v = (...rest)=>new Validator().v(...rest)

const puppeteer = require('puppeteer')

const utils = require('./scripts/utils')

let server
let browser
before(async function(){
    this.timeout(10000)
    server = utils.createServer({
        public: path.resolve(__dirname, '../dist'),
    })
    server.port = server.address().port
    browser = await puppeteer.launch()
})
after(async ()=>{
    await browser?.close?.()
    await server?.close?.()
})
let page
beforeEach(async function(){
    this.timeout(10000)
    pages = await browser.pages()
    page = pages?.[0] || await browser.newPage()
    await page.goto(`http://localhost:${server.port}/debug.html`)
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
        it('no configs', async function(){
            this.timeout(3000)
            await new Promise(r=>setTimeout(r, 2000))
            let { ret, msgs, db, hasError } = await utils.evaluate(page, ()=>{
                let db = new AnfoDB()
            })
            assert(hasError && db.find(i=>i.type === 'error')?.errno === '-100', '没提供合适配置，没输出对应报错')
        })

        it('put get', async ()=>{
            let { ret } = await utils.evaluate(page, async ()=>{
                let db = await (new AnfoDB({
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
                let db = await(new AnfoDB({
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
                let db = await(new AnfoDB({
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
                let db = await(new AnfoDB({
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

        it('count', async()=>{
            let { ret } = await utils.evaluate(page, async ()=>{
                let db = await (new AnfoDB({
                    db: 'test',
                    stores: {
                        test: {
                            keyPath: 'id',
                        }
                    }
                })).init()
                await db.store('test').put({id: 1, hello: 'hello', world: 'world'})
                await db.store('test').put({id: 2, hello: 'hello', world: 'world'})
                await db.store('test').put({id: 3, hello: 'hello', world: 'world'})
                await db.store('test').put({id: 4, hello: 'hello', world: 'world'})
                return await db.store('test').count()
            }, {debug: true})
            assert(ret === 4, '返回结果错误')
        })
        it('getAll delete', async function(){
            this.timeout(5000)
            let { ret } = await utils.evaluate(page, async ()=>{
                let db = await (new AnfoDB({
                    db: 'test',
                    stores: {
                        test: {
                            keyPath: 'id',
                            indexes: [
                                ['hello', 'hello']
                            ]
                        }
                    }
                })).init()
                await db.store('test').put({id: 1, hello: 'hello1', world: 'world'})
                await db.store('test').put({id: 2, hello: 'hello2', world: 'world'})
                await db.store('test').put({id: 3, hello: 'hello2', world: 'world'})
                await db.store('test').put({id: 4, hello: 'hello4', world: 'world'})
                await db.store('test').put({id: 5, hello: 'hello5', world: 'world'})
                await db.store('test').delete(5)
                await db.store('test').delete(IDBKeyRange.only(2))
                return await db.store('test').getAll()
            })
            assert(await v(ret, {
                $: 'array',
                $subItem: {
                    id: ['number', '=1 || =3 || =4'],
                    hello: '=hello1 || =hello2 || =hello4',
                    world: '=world',
                },
            }), '返回结果错误')
        })
        
        it('clear', async function(){
            this.timeout(5000)
            let { ret } = await utils.evaluate(page, async ()=>{
                let db = await (new AnfoDB({
                    db: 'test',
                    stores: {
                        test: {
                            keyPath: 'id',
                            indexes: [
                                ['hello', 'hello']
                            ]
                        }
                    }
                })).init()
                await db.store('test').put({id: 1, hello: 'hello1', world: 'world'})
                await db.store('test').put({id: 2, hello: 'hello2', world: 'world'})
                await db.store('test').clear()
                return await db.store('test').count()
            })
            assert(ret === 0, '返回结果错误')
        })
    })


    describe('db version change', async ()=>{
        it('add store', async()=>{
            let { ret, msgs } = await utils.evaluate(page, async()=>{
                let db = await(new AnfoDB({
                    db: 'test',
                    debug: 'debug',
                    stores: {}
                }).init())

                db = await(new AnfoDB({
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
                let db = await(new AnfoDB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                        test: {
                            keyPath: 'id'
                        }
                    }
                }).init())
                
                db = await(new AnfoDB({
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
                let db = await(new AnfoDB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                        test: {
                            keyPath: 'id'
                        }
                    }
                }).init())
                
                await (new AnfoDB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                    },
                    upgradePromise: Promise.reject(),
                }).init())
            })
        })

        it('resolve upgrade timeout(promise)', async function(){
            this.timeout(3000)
            let { ret } = await utils.evaluate(page, async()=>{
                let db = await(new AnfoDB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                        test: {
                            keyPath: 'id'
                        }
                    }
                }).init())

                let offset = Date.now()
                await (new AnfoDB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                    },
                    upgradePromise: new Promise(r=>setTimeout(r, 2000)),
                }).init())
                return Date.now() - offset
            })
            assert(ret > 2000, 'timeout不生效')
        })

        it('resolve upgrade timeout(promiseFunction)', async function(){
            this.timeout(3000)
            let { ret } = await utils.evaluate(page, async()=>{
                let db = await(new AnfoDB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                        test: {
                            keyPath: 'id'
                        }
                    }
                }).init())

                let offset = Date.now()
                await (new AnfoDB({
                    db: 'test',
                    debug: 'debug',
                    stores: {
                    },
                    upgradePromise: ()=>new Promise(r=>setTimeout(r, 2000)),
                }).init())
                return Date.now() - offset
            })
            assert(ret > 2000, 'timeout不生效')
        })

    })
})