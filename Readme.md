## git-blob-stream

[![Build Status](https://travis-ci.org/vsivsi/git-blob-stream.svg)](https://travis-ci.org/vsivsi/git-blob-stream)

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
  header: false          // Default, blob header retained in output if truthy
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

var hashFunc = function (hash) {
  // hash is a buffer containing the 20 byte SHA1 sum, or a string if
  // a non-default hoshFormat is specified
}

// All options are manditory!
var xformStream = gbs.blobWriter({
  size: fs.statSync("filename").size,  // Required!
  type: "blob",                        // Default, or "tree", "tag" or "commit"
  hashFormat: 'buffer'                 // Default, or 'hex' string
  hashCallback: hashFunc,              // Get the SHA1 hash, if omitted
                                       // output stream contains the hash
});

// Write the file. hashCallback will be called when finished
input.pipe(xformStream).pipe(output);

output.on('close', function () {
  // All done
});
```

#### Higher level git objects

In addition to blobs, this library can also stream to/from [js-git](https://github.com/creationix) style tree objects.

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
    hashFormat: 'buffer'                 // Default, or 'hex' string
    hashCallback: hashFunc,              // Get the SHA1 hash, if omitted
                                       // output stream contains the hash
  }
);

// Write the file. hashCallback will be called when finished
xformStream.pipe(output);

output.on('close', function () {
  // All done
});
```

Enjoy!
