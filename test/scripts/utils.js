module.exports = {
    _pushMessage(arr, msg, contentFormatter){
        let content = msg._text
        let keyContent = Object.keys(contentFormatter)?.reduce?.((t, key)=>{
            t[key] = contentFormatter[key]?.exec?.(content)?.[1]
            return t
        }, {}) || {}
        arr.push({
            ...keyContent,
            type: msg._type,
            content: msg._text,
        })
    },
    async evaluate(page, func, {
        debug = false,
        msgsGetter = {
            db: /^\[db\]/,
        },
        contentFormatter = ({
            errno: /^\[db\]\[.+\]\[errno: (.+)\]/,
        })} = {}){
        return new Promise((r, reject)=>{
            let msgs = []
            let keyMsgs = {}
            let keys = Object.keys(msgsGetter)
            page.on('console', msg=>{
                if(debug){
                    console.log(`[${msg._type}]${msg._text}`)
                }
                this._pushMessage(msgs, msg, contentFormatter)
                keys.forEach(key=>{
                    if(msgsGetter?.[key]?.test?.(msg._text)){
                        if(!keyMsgs[key]){
                            keyMsgs[key] = []
                        }
                        this._pushMessage(keyMsgs[key], msg, contentFormatter)
                    }
                })
            })
            return page.evaluate(func).then(ret=>{
                setTimeout(()=>{
                    r({
                        ...keyMsgs,
                        ret,
                        msgs,
                        hasError: msgs.filter(m=>m.type === 'error')?.length > 0
                    })
                })
            }).catch(reject)
        })
    },
}