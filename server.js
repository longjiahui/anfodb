const http = require('http')
const handler = require('serve-handler')
const path = require("path")
    function createServer(options = {}){
        let server = http.createServer((req, res)=>{
            return handler(req, res, options)
        })
        return server.listen()
    }

    server = createServer({
        path: path.resolve(__dirname, 'dist'),
    })
    // server.port = server.address().port
    console.log(server.address().port)