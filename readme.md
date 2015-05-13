# mount-url

mount a file from a http url as a local file using fuse from the CLI. uses http range requests and streaming.

[![NPM](https://nodei.co/npm/mount-url.png)](https://nodei.co/npm/mount-url/)

## installation

requires fuse. on mac you can `brew install osxfuse`

```
npm install -g mount-url
```

## usage

```
mount-url <url>
```

will create a file in the current directory using the basename of the `url`. the file will appear like a normal file but will use http `Range` requests to support random access to the file

## how it works

First we do a GET request to the URL provided, but abort it as soon as we have the headers. If the server doesn't return `accept-ranges: bytes` then mount-url won't work with this file and we abort (because we can't have random access to the file so it isn't worth it to mount as a fuse file).

Then we create a fuse directory in your `os.tmpdir()`, create a file in that directory, symlink a file in your `process.cwd()` to point to the tmp fuse mounted file, and then proxy requests for data to the file and convert them into HTTP range requests for the bytes that the fuse file requests.

This means you can mount a e.g. 10GB movie file, open VLC and skip to the middle of the movie and it can skip to the middle of the file without downloading the entire first half first (this is a contrived example as VLC already supports HTTP range requests).

## JS API

first require it:

```
var mount = require('mount-url')
```

this returns a function that can be used to mount a url. it takes two arguments, a url and a callback. the callback will be called with `err, cleanup`. if there is an error, you don't have to cleanup. `cleanup` is a function that, if your file mounted successfully (e.g. if there was no `err`) you can call to unmount the file safely before exiting.

### example

```
mount(someURL, function mounted (err, cleanup) {
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
```
