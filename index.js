/***************************************************************************
###  Copyright (C) 2015 by Vaughn Iverson
###  git-blob-stream is free software released under the MIT/X11 license.
###  See included LICENSE file for details.
***************************************************************************/

var zlib = require('zlib'),
    crypto = require('crypto'),
    through2 = require('through2'),
    duplexer2 = require('duplexer2');

var blobWriter = function (options) {
  if (!options.size || (typeof options.size !== 'number')) {
    console.error('Invalid size option passed to blobWriter');
    return null;
  }
  if (!options.type || (typeof options.type !== 'string')) {
    console.error('Invalid type option passed to blobWriter');
    return null;
  }
  if (!options.hashCallback || (typeof options.hashCallback !== 'function')) {
    console.error('Invalid hashCallback option passed to blobWriter');
    return null;
  }
  var sha1 = crypto.createHash('sha1');
  var transform = through2(
    function (chunk, enc, cb) {
      sha1.update(chunk, enc);
      this.push(chunk);
      cb();
    },
    function (cb) {
      options.hashCallback(sha1.digest('hex'));
      cb();
    }
  );
  transform.write(new Buffer(options.type + " " + options.size + "\0"));
  return duplexer2(transform, transform.pipe(zlib.createDeflate()));
};

var blobReader = function () {
  var header = true;
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
