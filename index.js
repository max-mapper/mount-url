var path = require('path')
var url = require('url')
var fuse = require('fuse-bindings')
var mkdirp = require('mkdirp')
var contentRange = require('content-range')
var headers = require('request-headers')

var ENOENT = -2
var EPERM = -1

var arg = process.argv[2]
if (!arg) {
  console.error('Usage: mount-url <url>')
  process.exit(1)
}

var parsed = url.parse(arg)
var filename = path.basename(parsed.pathname)
var handlers = {}
var file

var mnt = path.join(process.cwd(), filename)
fuse.unmount(mnt, function () {
  mkdirp(mnt, function () {
    fuse.mount(mnt, handlers)
  })
})

// fuse handlers
handlers.displayFolder = false

handlers.getattr = function (filepath, cb) {
  filepath = filepath.slice(1)

  var stat = {}

  stat.ctime = new Date()
  stat.mtime = new Date()
  stat.atime = new Date()
  stat.uid = process.getuid()
  stat.gid = process.getgid()

  if (file) {
    stat.size = file.length
    stat.mode = 33206 // 0100666
    return cb(0, stat)
  }

  stat.size = 4096
  stat.mode = 16877 // 040755
  cb(0, stat)
}

handlers.open = function (path, flags, cb) {
  path = path.slice(1)

  requestHeaders(arg, function (err, statusCode, headers) {
    if (err) {
      console.error('HTTP Error')
      return cb(ENOENT)
    }
    
    if (!headers['accept-ranges'] || headers['accept-ranges'] !== 'bytes') {
      console.error('HTTP resource doesnt not support accept-ranges: bytes')
      return cb(ENOENT)
    }

    var length = headers['content-type']

    if (!length) length = 4096
    else length = +length
      
    file = {length: length}
      
    cb(0, 42)
  })
}

handlers.release = function (path, handle, cb) {
  cb(0)
}

handlers.read = function (path, handle, buf, len, offset, cb) {
  if (!file) return cb(ENOENT)

  if (len + offset > file.length) len = file.length - offset

  var range = contentRange.format({
    name: 'bytes',
    offset: offset,
    limit: len,
    count: len
  })

  var rangeReq = request(arg, {headers: {'content-range': range}})
  
  var loop = function () {
    var result = rangeReq.read(len)
    if (!result) return rangeReq.once('readable', loop)
    console.error('writing', result.length)
    buf.copy(result)
    return cb(result.length)
  }

  loop()
}

handlers.readdir = function (path, cb) {
  cb(EPERM)
}

handlers.write = function (path, handle, buf, len, offset, cb) {
  cb(EPERM)
}

handlers.unlink = function (path, cb) {
  cb(EPERM)
}

handlers.rename = function (src, dst, cb) {
  cb(EPERM)
}

handlers.mkdir = function (path, mode, cb) {
  cb(EPERM)
}

handlers.rmdir = function (path, cb) {
  cb(EPERM)
}

handlers.create = function (path, mode, cb) {
  cb(EPERM)
}

handlers.getxattr = function (path, name, buffer, length, offset, cb) {
  cb(EPERM)
}

handlers.setxattr = function (path, name, buffer, length, offset, flags, cb) {
  cb(0)
}

handlers.statfs = function (path, cb) {
  cb(0, {
    bsize: 1000000,
    frsize: 1000000,
    blocks: 1000000,
    bfree: 1000000,
    bavail: 1000000,
    files: 1000000,
    ffree: 1000000,
    favail: 1000000,
    fsid: 1000000,
    flag: 1000000,
    namemax: 1000000
  })
}

handlers.destroy = function (cb) {
  cb()
}
