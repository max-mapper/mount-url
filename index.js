#!/usr/bin/env node
var os = require('os')
var path = require('path')
var url = require('url')
var fs = require('fs')
var fuse = require('fuse-bindings')
var mkdirp = require('mkdirp')
var request = require('request')
var through = require('through2')

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

var mnt = path.join(os.tmpdir(), 'mounturl/' + Date.now())
console.error(mnt)

requestHeaders(arg, function (err, statusCode, headers) {
  if (err) {
    console.error('HTTP Error')
    process.exit(1)
  }

  if (!headers['accept-ranges'] || headers['accept-ranges'] !== 'bytes') {
    console.error('HTTP resource doesnt support accept-ranges: bytes')
    console.error(headers, statusCode)
    process.exit(1)
  }

  var len = headers['content-length']

  if (!len) len = 4096
  else len = +len
  
  file = {length: len, headers: headers}
  console.error('file', file)
  
  fuse.unmount(mnt, function () {
    mkdirp(mnt, function () {
      fuse.mount(mnt, handlers)
      fs.symlink(path.join(mnt, filename), path.join(process.cwd(), filename), function (err) {
        if (err) {
          console.error('Error!', err.message)
          cleanup(err)
        }
      })
    })
  })
})

process.on('SIGINT', cleanup)

function cleanup () {
  fs.unlink(path.join(process.cwd(), filename), function (err) {
    fuse.unmount(mnt, function () {
      process.exit()
    })
  })
}

function requestHeaders (href, cb) {
  var req = request.get(href)

  req.on('response', function (res) {
    req.abort()
    cb(null, res.statusCode, res.headers)
  })
  
  req.on('error', function (err) {
    cb(err)
  })

  return req
}

// fuse handlers
handlers.displayFolder = true

handlers.readdir = function (filepath, cb) {
  console.error('readdir', filepath)
  if (filepath === '/') return cb(0, [filename])
  cb(0)
}

handlers.getattr = function (filepath, cb) {
  console.error('getattr', filepath)

  if (filepath.slice(0, 2) === '/.') {
    return cb(EPERM)
  }
  
  if (filepath === '/') {
    cb(0, {
      mtime: new Date(),
      atime: new Date(),
      ctime: new Date(),
      size: 100,
      mode: 16877,
      uid: process.getuid(),
      gid: process.getgid()
    })
    return
  }
  
  if (!file) return cb(EPERM)
  
  var stat = {}

  stat.ctime = new Date()
  stat.mtime = new Date()
  stat.atime = new Date()
  stat.uid = process.getuid()
  stat.gid = process.getgid()

  stat.size = file.length
  stat.mode = 33206 // 0100666
  console.error('getattr stat', stat)
  return cb(0, stat)
}

handlers.open = function (path, flags, cb) {
  cb(0)
}

handlers.release = function (path, handle, cb) {
  cb(0)
}

handlers.read = function (filepath, handle, buf, len, offset, cb) {
  if (!file) return cb(ENOENT)

  var range = offset + '-' + (offset + len - 1)
  var contentLength

  var rangeReq = request(arg, {headers: {'Range': 'bytes=' + range}})
  rangeReq.on('response', function (res) {
    contentLength = +res.headers['content-length']
    console.log('requested', range, 'received', contentLength, 'bytes')
    loop()
  })
  var proxy = through()
  rangeReq.pipe(proxy)
  
  var loop = function () {
    var result = proxy.read(contentLength)
    if (!result) return proxy.once('readable', loop)
    buf.copy(result)
    return cb(result.length)
  }
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
