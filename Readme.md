## git-blob-stream

[![Build Status](https://travis-ci.org/vsivsi/git-blob-stream.svg)](https://travis-ci.org/vsivsi/git-blob-stream)

**WARNING** This package is still under active development, I reserve the right to change anything until 0.1.0 is released. At that point I'll go all SemVer and everything.

This npm package makes it easy and efficient to read and write Git blob files using node.js Stream2 streams. It has no dependencies on command line git or native code git libraries; instead using crypto and compression libraries already built into node.js.

### Installation

```bash
npm install git-blob-stream

# To run tests from within the package directory
npm install && npm test
```

### Usage

##### To read a blob file:

```javascript
var fs = require('fs');
var gbs = require('git-blob-stream');

var input = fs.createReadStream("filename.blob");
var output = fs.createWriteStream("filename");

var xformStream = gbs.blobReader({
  header: false         // Default, output blob data in stream
                        // If true, the stream output is an object:
                        // { type: <blobType>, size: <blobDataLength> }
});

// Decode the file...
input.pipe(xformStream).pipe(output);

output.on('close', function () {
  // All done
});
```

##### To write a blob file:

```javascript
var fs = require('fs');
var gbs = require('git-blob-stream');

var input = fs.createReadStream("filename");
var output = fs.createWriteStream("filename.blob");

var hashFunc = function (ret) {
  // ret is an object:
  // { size: <blobDataLength>, hash: <hashValue> }
  // hashValue is a buffer containing the 20 byte SHA1 sum, or a string if
  // a non-default hoshFormat is specified
}

// All options are manditory!
var xformStream = gbs.blobWriter({
  size: fs.statSync("filename").size,  // Optional, but more efficient if provided!
  type: "blob",                        // Default, or "tree", "tag" or "commit"
  hashFormat: 'buffer'                 // Default, or 'hex' string
  hashCallback: hashFunc,              // Get the SHA1 hash, if omitted
                                       // output stream contains the ret object
});

// Write the file. hashCallback will be called when finished
input.pipe(xformStream).pipe(output);

output.on('close', function () {
  // All done
});
```

#### Higher level git objects

In addition to blobs, this package can also stream to/from [js-git](https://github.com/creationix) style tree, commit and tag objects.

##### To read a tree blob file:

```javascript
var fs = require('fs');
var gbs = require('git-blob-stream');
var input = fs.createReadStream("tree.blob");
var xformStream = gbs.treeReader();

// Decode the file...
output = input.pipe(xformStream);

output.on('data', function (data) {
  // data is a tree object
  // This will only be called once
});

output.on('end', function () {
  // All done
});
```

##### To write a tree blob file:

```javascript
var fs = require('fs');
var gbs = require('git-blob-stream');

var output = fs.createWriteStream("tree.blob");

var hashFunc = function (hash) {
  // hash is a buffer containing the 20 byte SHA1 sum, or a string if
  // a non-default hoshFormat is specified
}

// All options are manditory!
var xformStream = gbs.treeWriter(
  {
    'greetings.txt' : { mode: gbs.gitModes.file, hash: fileHash }
  },
  {
    hashFormat: 'buffer'          // Default, or 'hex' string
    hashCallback: hashFunc,       // Get the SHA1 hash, if omitted output
                                  // stream contains the size/hash obj
  }
);

// Write the file. hashCallback will be called when finished
xformStream.pipe(output);

output.on('close', function () {
  // All done
});
```

Analogous calls for reading/writing commits and (annotated) tags also exist:
`commitReader`, `commitWriter`, `tagReader`, `tagWriter`.
All assume [js-git](https://github.com/creationix) style objects.

Enjoy!
