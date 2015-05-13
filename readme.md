# mount-url

mount a file from a http url as a local file using fuse from the CLI. uses http range requests

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
