#!/usr/bin/env node
var mounturl = require('./index.js')

var arg = process.argv[2]

if (!arg) {
  console.error('Usage: mount-url <url>')
  process.exit(1)
}

mounturl(arg, function (err, cleanup) {
  if (err) {
    console.error(err.message)
    process.exit(1)
  }
  process.on('SIGINT', function () {
    cleanup(function () {
      process.exit(1)
    })
  })
})
