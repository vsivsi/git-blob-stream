/***************************************************************************
###  Copyright (C) 2015 by Vaughn Iverson
###  git-blob-stream is free software released under the MIT/X11 license.
###  See included LICENSE file for details.
***************************************************************************/

var zlib = require('zlib'),
    crypto = require('crypto'),
    through2 = require('through2'),
    streamifier = require('streamifier'),
    duplexer2 = require('duplexer2');

var validHashOutputFormats = { 'hex': true, 'buffer': true };
var validBlobTypes = { 'blob': true, 'tree': true, 'commit': true, 'tag': true };

var blobWriter = function (options) {
  if (options) {
    if (typeof options !== 'object') {
      console.error('Bad options object passed to blobWriter');
      return null;
    }
  } else {
    options = {};
  }
  if (!options.size || (typeof options.size !== 'number')) {
    console.error('Invalid size option passed to blobWriter');
    return null;
  }
  if (options.type) {
    if ((typeof options.type !== 'string') ||
        !(options.type in validBlobTypes)) {
      console.error('Invalid type option passed to blobWriter');
      return null;
    }
  } else {
    options.type = 'blob';
  }
  if (options.hashCallback && (typeof options.hashCallback !== 'function')) {
    console.error('Invalid hashCallback option passed to blobWriter');
    return null;
  }
  if (options.hashFormat) {
    if (typeof options.hashFormat !== 'string' ||
        !(options.hashFormat in validHashOutputFormats)) {
      console.error('Invalid hashFormat option passed to blobWriter');
      return null;
    }
    if (options.hashFormat === 'buffer') {
      delete options.hashFormat;
    }
  }
  var sha1 = crypto.createHash('sha1');
  var transform = through2(
    function (chunk, enc, cb) {
      sha1.update(chunk, enc);
      if (options.hashCallback) {
        this.push(chunk);
      }
      cb();
    },
    function (cb) {
      var hash = sha1.digest(options.hashFormat);
      if (options.hashCallback) {
        options.hashCallback(hash);
      } else {
        this.push(hash);
      }
      cb();
    }
  );
  transform.write(new Buffer(options.type + " " + options.size + "\0"));
  if (options.hashCallback) {
    return duplexer2(transform, transform.pipe(zlib.createDeflate()));
  } else {
    return transform;
  }
};

var blobReader = function (options) {
  if (options) {
    if (typeof options !== 'object') {
      console.error('Bad options object passed to blobReader');
      return null;
    }
  } else {
    options = {};
  }
  var header = true;
  if (options.header) {
    header = false;
  }
  var inflator = zlib.createInflate();
  var transform = through2(
    function (chunk, enc, cb) {
      if (header) {
        for (var idx = 0; idx < chunk.length; idx++) {
          if (chunk[idx] === 0) {
            header = false;
            this.push(chunk.slice(idx+1));
            break;
          }
        }
      } else {
        this.push(chunk);
      }
      cb();
    }
  );
  return duplexer2(inflator, inflator.pipe(transform));
};

// Lifted from: https://github.com/creationix/js-git/blob/master/lib/modes.js
// MIT Licensed
var gitModes = {
  isBlob: function (mode) {
    return (mode & 0140000) === 0100000;
  },
  isFile: function (mode) {
    return (mode & 0160000) === 0100000;
  },
  toType: function (mode) {
    if (mode === 0160000) return "commit";
    if (mode ===  040000) return "tree";
    if ((mode & 0140000) === 0100000) return "blob";
    return "unknown";
  },
  tree:    040000,
  blob:   0100644,
  file:   0100644,
  exec:   0100755,
  sym:    0120000,
  commit: 0160000
};

// Lifted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function treeMap(key) {
  var entry = this[key];
  return {
    name: key,
    mode: entry.mode,
    hash: entry.hash
  };
}

// Lifted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function treeSort(a, b) {
  var aa = (a.mode === gitModes.tree) ? a.name + "/" : a.name;
  var bb = (b.mode === gitModes.tree) ? b.name + "/" : b.name;
  return aa > bb ? 1 : aa < bb ? -1 : 0;
}

// Adapted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
var treeWriter = function (body, options) {
  if (options) {
    if (typeof options !== 'object') {
      console.error('Bad options object passed to blobReader');
      return null;
    }
  } else {
    options = {};
  }
  var treeBuffers = [];
  var tbSize = 0;
  if (Array.isArray(body)) throw new TypeError("Tree must be in object form");
  var list = Object.keys(body).map(treeMap, body).sort(treeSort);
  for (var i = 0, l = list.length; i < l; i++) {
    var entry = list[i];
    if (typeof entry.hash === 'string') {
      entry.hash = new Buffer(entry.hash, 'hex');
    }
    treeBuffers[2*i] = new Buffer(entry.mode.toString(8) + " " + entry.name + "\0");
    treeBuffers[2*i+1] = entry.hash;
    tbSize += treeBuffers[2*i].length + treeBuffers[2*i+1].length;
  }
  var buff = Buffer.concat(treeBuffers, tbSize);
  options.size = tbSize;
  options.type = 'tree';
  return streamifier.createReadStream(buff).pipe(blobWriter(options));
};

module.exports = exports = {
  blobWriter: blobWriter,
  blobReader: blobReader,
  treeWriter: treeWriter,
  gitModes: gitModes
};
