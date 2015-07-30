## git-blob-stream

This npm package makes it easy and efficient to read and write Git blob files
of any type using node.js Stream2 streams.

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

// Decode the file...
input.pipe(gbs.blobReader()).pipe(output);

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
  // has is a hexidecimal SHA1 sum string, just like git uses
}

// All options are manditory!
var xformStream = gbs.blobWriter({
  type: "blob",                        // Or perhaps "tree" or "commit"
  size: fs.statSync("filename").size,  // Gotta have it!
  hashCallback: hashFunc               // Get the hash back
});

// Write the file. hashCallback will be called when finished
input.pipe(xformStream).pipe(output);

output.on('close', function () {
  // All done
});
```

Enjoy!
