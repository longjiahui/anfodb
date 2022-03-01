const TYPE_DATAURL = 'dataurl'
const TYPE_BLOB = 'blob'

const base64RegExp = /^data:(image\/\S+);base64 /

export default class ImageCompressor {
    constructor(img){
        // dataURL / image
        if(typeof img === 'string' && base64RegExp.test(img)){
            // base64URL
            this.type = TYPE_DATAURL
            this.format = base64RegExp.exec(img)?.[1]
        }else if(img instanceof Blob){
            this.type = TYPE_BLOB
            this.format = img.type
        }else{
            console.error('the type of parameter is invalid!')
        }
        this.data = img
    }

    static async fromImage(image){
        if(image instanceof HTMLImageElement || image instanceof Image){
            if(!image.complete){
                
            }
        }
    }

    _isBlob(type){
        return type || this.type === TYPE_BLOB
    }
    _isDataURL(type){
        return type || this.type === TYPE_DATAURL
    }

    getSize(){
        if(this._isDataURL()){
            return this.data?.length || 0
        }else if(this._isBlob()){
            return this.data?.size || 0
        }
    }

    // toType:  TYPE_BLOB
    //          TYPE_DATAURL
    // rest: format, quality
    async reform({
        toType,
        format: toFormat,
        quality = 1
    }){
        toFormat = toFormat || this.format
        let src = this.data
        if(this._isBlob()){
            src = URL.createObjectURL(this.data)
        }
        return new Promise((r, reject)=>{
            let image = new Image()
            image.onload = ()=>r(image)
            image.onerror = reject
            image.src = src
        }).then(image=>{
            let canvas = documnet.createElement('canvas')
            canvas.width = image.width
            canvas.height = image.height
            let ctx = canvas.getContext('2d')
            ctx.drawImage(image, 0, 0)
            if(!toType){
                toType = this.type
            }
            if(this._isBlob(toType)){
                return new Promise(r=>{
                    canvas.toBlob(r, toFormat, quality)
                })
            }else if(this._isDataURL(toType)){
                return canvas.toDataURL(toFormat, quality)
            }
        }).then(res=>{
            this.data = res
            return res
        })
    }

    reformToDataURL(format, quality){
        return this.reform({
            toType: TYPE_DATAURL,
            format,
            quality})
    }
    reformToBlob(format, quality){
        return this.reform({
            toType: TYPE_BLOB,
            format,
            quality})
    }
    async toDataURL(){
        if(this._isBlob()){
            return new Promise((r, reject)=>{
                let reader = new FileReader()
                reader.onload = e=>r(e.target.result)
                reader.onerror = reject
                reader.readAsDataURL(this.data)
            })
        }else if(this._isDataURL()){
            return this.data
        }
    }
    toBlob(){
        if(this._isBlob()){
            return this.data
        }else if(this._isDataURL()){
            var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n)
            while(n--){
                u8arr[n] = bstr.charCodeAt(n)
            }
            return new Blob([u8arr], {type:mime})
        }
    }

    compress({
        toSize,
        threshold = .1,

        _quality = .5,
        _prevQuality = 1,
        _maxTry = 10,
        _count = 0,
    }){
        if(_count > _maxTry){
            console.warn(`大于最大尝试次数(_maxTry: ${_maxTry})，停止压缩(current: ${this.getSize()})`)
            return this.data
        }
        _count += 1
        if(this.format !== 'image/jpeg'){
            console.warn(`参数MIME不是image/jpeg(current: ${format})`)
            return this.data
        }
        let initialSize = this.getSize()
        if(initialSize < toSize){
            console.warn(`图片已经小于压缩至的图像(current: ${initialSize}, to: ${toSize})`)
            return this.data
        }else{
            return this.reform({
                quality: _quality,
            }).then(()=>{
                let size = this.getSize()
                let reasonableSize = threshold * toSize

                if(Math.abs(size - toSize) < reasonableSize){
                    console.debug(`match: quality(${_quality}) currentSize(${size / 1024}KBs) abs(${Math.abs(size - toSize)}Bytes) reasonableSize(${reasonableSize}Bytes) toSize(${toSize / 1024}KBs)`)
                    return this.data
                }else if(size > toSize){
                    let toQuality = _quality - Math.abs(_quality - _prevQuality) / 2
                    console.debug(`to(-): quality(${toQuality}) currentSize(${size / 1024}KBs)`)
                    return this.compress({
                        toSize,
                        threshold,

                        _quality: toQuality,
                        _prevQuality: _quality,
                        _maxTry,
                        _count,
                    })
                }else{
                    let toQuality = _quality + Math.abs(_quality - _prevQuality) / 2
                    console.debug(`to(-): quality(${toQuality}) currentSize(${size / 1024}KBs)`)
                    return this.compress({
                        toSize,
                        threshold,

                        _quality: toQuality,
                        _prevQuality: _quality,
                        _maxTry,
                        _count,
                    })
                }
            })
        }
    }
}