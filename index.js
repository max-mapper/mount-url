var os = require('os')
var path = require('path')
var url = require('url')
var fs = require('fs')
var fuse = require('fuse-bindings')
var mkdirp = require('mkdirp')
var request = require('request')
var through = require('through2')
var debug = require('debug')('mount-url')

const dbug = true

module.exports = function (href, cb) {
  var parsed = url.parse(href)
  var filename = path.basename(parsed.pathname)
  var handlers = {}
  var file

  var mnt = path.join(os.tmpdir(), 'mounturl/' + Date.now() + '-' + Math.floor(Math.random() * 900000 + 100000))
  if (dbug) debug(mnt)

  requestHeaders(href, function (err, statusCode, headers) {
    if (err) return cb(new Error('HTTP Error ' + statusCode))

    if (!headers['accept-ranges'] || headers['accept-ranges'] !== 'bytes') {
      if (dbug) debug('range not supported', headers, statusCode)
      return cb(new Error('The HTTP server supplied doesnt support accept-ranges: bytes, so mount-url wont work for this url, sorry.'))
    }

    var len = headers['content-length']

    if (!len) len = 4096
    else len = +len
  
    file = {length: len, headers: headers}
    if (dbug) debug('file', file)
  
    fuse.unmount(mnt, function () {
      mkdirp(mnt, function () {
        fuse.mount(mnt, handlers, function (err) {
          if (err) {
            cleanup(function () {
              cb(new Error('Mount error: ' + err.message))
            })
            return
          }
          fs.symlink(path.join(mnt, filename), path.join(process.cwd(), filename), function (err) {
            if (err) {
              cleanup(function () {
                cb(new Error('Symlink error: ' + err.message))
              })
              return
            }
            cb(null, cleanup)
          })
        })
      })
    })
  })

  function cleanup (cb) {
    fs.unlink(path.join(process.cwd(), filename), function (err) {
      fuse.unmount(mnt, function () {
        if (cb) cb()
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
    if (dbug) debug('readdir', filepath)
    if (filepath === '/') return cb(0, [filename])
    cb(0)
  }

  handlers.getattr = function (filepath, cb) {
    if (dbug) debug('getattr', filepath)

    if (filepath.slice(0, 2) === '/.') {
      return cb(fuse.EPERM)
    }
  
    if (filepath === '/') {
      cb(0, {
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        nlink: 2,
        size: 4096,
        mode: 16877,
        uid: process.getuid(),
        gid: process.getgid()
      })
      return
    }
  
    if (!file) return cb(fuse.EPERM)
  
    var stat = {}

    stat.ctime = new Date()
    stat.mtime = new Date()
    stat.atime = new Date()
    stat.nlink = 1
    stat.uid = process.getuid()
    stat.gid = process.getgid()

    stat.size = file.length
    stat.mode = 33206 // 0100666
    if (dbug) debug('getattr stat', stat)
    return cb(0, stat)
  }

  handlers.open = function (path, flags, cb) {
    cb(0)
  }

  handlers.release = function (path, handle, cb) {
    cb(0)
  }

  handlers.read = function (filepath, handle, buf, len, offset, cb) {
    if (!file) return cb(fuse.ENOENT)

    var range = offset + '-' + (offset + len - 1)
    var contentLength

    var rangeReq = request(href, {headers: {'Range': 'bytes=' + range}})
    rangeReq.on('response', function (res) {
      contentLength = +res.headers['content-length']
      if (dbug) debug('requested', range, 'received', contentLength, 'bytes')
      loop()
    })
    var proxy = through()
    rangeReq.pipe(proxy)
  
    var loop = function () {
      var result = proxy.read(contentLength)
      if (!result) return proxy.once('readable', loop)
      result.copy(buf)
      return cb(result.length)
    }
  }

  handlers.write = function (path, handle, buf, len, offset, cb) {
    cb(fuse.EPERM)
  }

  handlers.unlink = function (path, cb) {
    cb(fuse.EPERM)
  }

  handlers.rename = function (src, dst, cb) {
    cb(fuse.EPERM)
  }

  handlers.mkdir = function (path, mode, cb) {
    cb(fuse.EPERM)
  }

  handlers.rmdir = function (path, cb) {
    cb(fuse.EPERM)
  }

  handlers.create = function (path, mode, cb) {
    cb(fuse.EPERM)
  }

  handlers.getxattr = function (path, name, buffer, length, offset, cb) {
    cb(fuse.ENODATA)
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
}

