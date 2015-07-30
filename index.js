/***************************************************************************
###  Copyright (C) 2015 by Vaughn Iverson
###  git-blob-stream is free software released under the MIT/X11 license.
###  See included LICENSE file for details.
***************************************************************************/

var zlib = require('zlib'),
    crypto = require('crypto'),
    through2 = require('through2'),
    duplexer2 = require('duplexer2');

var validHashOutputFormats = { 'hex': true, 'base64': true, 'binary': true };
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
  } else {
    options.hashFormat = 'hex';
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
      if (options.hashCallback) {
        options.hashCallback(sha1.digest(options.hashFormat));
      } else {
        var hash = sha1.digest(options.hashFormat);
        this.push(new Buffer (hash));
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

module.exports = exports = { blobWriter: blobWriter, blobReader: blobReader };
