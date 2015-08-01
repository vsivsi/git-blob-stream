/***************************************************************************
###  Copyright (C) 2015 by Vaughn Iverson
###  git-blob-stream is free software released under the MIT/X11 license.
###  See included LICENSE file for details.
###
###  Portions of this source file (as noted) are taken/adapted from js-git:
###  https://github.com/creationix/js-git
###  Copyright (c) 2013-2014 Tim Caswell <tim@creationix.com>
###  Under the terms of the MIT License
***************************************************************************/

var zlib = require('zlib'),
    crypto = require('crypto'),
    through2 = require('through2'),
    streamifier = require('streamifier'),
    duplexer2 = require('duplexer2');

var validHashOutputFormats = { 'hex': true, 'buffer': true };
var validBlobTypes = { 'blob': true, 'tree': true, 'commit': true, 'tag': true };

function optionChecker (options) {
  if (options) {
    if (typeof options !== 'object') {
      throw new Error('Bad options object passed');
    }
  } else {
    options = {};
  }
  return options;
}

var blobWriter = function (options) {
  options = optionChecker(options);
  if (!options.size || (typeof options.size !== 'number')) {
    throw new Error('Invalid size option passed to blobWriter');
  }
  if (options.type) {
    if ((typeof options.type !== 'string') ||
        !(options.type in validBlobTypes)) {
      throw new Error('Invalid type option passed to blobWriter');
    }
  } else {
    options.type = 'blob';
  }
  if (options.hashCallback && (typeof options.hashCallback !== 'function')) {
    throw new Error('Invalid hashCallback option passed to blobWriter');
  }
  if (options.hashFormat) {
    if (typeof options.hashFormat !== 'string' ||
        !(options.hashFormat in validHashOutputFormats)) {
      throw new Error('Invalid hashFormat option passed to blobWriter');
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
  options = optionChecker(options);
  var headerDone = false;
  if (!("header" in options)) options.header = false;
  var inflator = zlib.createInflate();
  var headerChunks = [];
  var transform = through2({ objectMode: options.header },
    function (chunk, enc, cb) {
      if (!headerDone) {
        for (var idx = 0; idx < chunk.length; idx++) {
          if (chunk[idx] === 0) {
            headerDone = true;
            if (options.header) {
              headerChunks.push(chunk.slice(0, idx));
            } else {
              this.push(chunk.slice(idx+1));
            }
            break;
          }
        }
        if (options.header) {
          if (headerDone) {
            var headerStr = Buffer.concat(headerChunks).toString();
            var spaceIdx = headerStr.indexOf(' ');
            if (spaceIdx < 1) throw new Error("Invalid blob header");
            var headerObj = {
              type: headerStr.slice(0, spaceIdx),
              size: parseInt(headerStr.slice(spaceIdx+1))};
            this.push(headerObj);
          } else {
            headerChunks.push(chunk);
          }
        }
      } else if (!options.header) {
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
  options = optionChecker(options);
  if (!options.strict) {
    body = normalizeTree(body);
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
    var b = new Buffer(entry.mode.toString(8) + " " + entry.name + "\0");
    treeBuffers.push(b);
    treeBuffers.push(entry.hash);
    tbSize += b.length + entry.hash.length;
  }
  var buff = Buffer.concat(treeBuffers, tbSize);
  options.size = tbSize;
  options.type = 'tree';
  return streamifier.createReadStream(buff).pipe(blobWriter(options));
};

// Lifted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function indexOf(buffer, byte, i) {
  i |= 0;
  var length = buffer.length;
  for (;;i++) {
    if (i >= length) return -1;
    if (buffer[i] === byte) return i;
  }
}

function genericReader(parser) {
  var input = blobReader();
  var chunkList = [];
  var chunkLen = 0;
  var transform = through2({ objectMode: true },
    function (chunk, enc, cb) {
      chunkLen += chunk.length;
      chunkList.push(chunk);
      cb();
    },
    function (cb) {
      this.push(parser(Buffer.concat(chunkList)));
      cb();
    }
  );
  return duplexer2(input, input.pipe(transform));
}

// Adapted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function treeParser(body) {
  var i = 0;
  var length = body.length;
  var start;
  var mode;
  var name;
  var hash;
  var tree = {};
  while (i < length) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    mode = parseInt(body.slice(start,i++),8);
    start = i;
    i = indexOf(body, 0x00, start);
    name = body.slice(start, i++).toString();
    hash = body.slice(i, i += 20).toString('hex');
    tree[name] = {
      mode: mode,
      hash: hash
    };
  }
  return tree;
}

treeReader = function () {
  return genericReader(treeParser);
};

// Lifted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function formatPerson(person) {
  return safe(person.name) +
    " <" + safe(person.email) + "> " +
    formatDate(person.date);
}

// Lifted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function safe(string) {
  return string.replace(/(?:^[\.,:;<>"']+|[\0\n<>]+|[\.,:;<>"']+$)/gm, "");
}

// Lifted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function two(num) {
  return (num < 10 ? "0" : "") + num;
}

// Lifted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function formatDate(date) {
  var seconds, offset;
  if (date.seconds) {
    seconds = date.seconds;
    offset = date.offset;
  }
  // Also accept Date instances
  else {
    seconds = Math.floor(date.getTime() / 1000);
    offset = date.getTimezoneOffset();
  }
  var neg = "+";
  if (offset <= 0) offset = -offset;
  else neg = "-";
  offset = neg + two(Math.floor(offset / 60)) + two(offset % 60);
  return seconds + " " + offset;
}

// Adapted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
var tagWriter = function (body, options) {
  options = optionChecker(options);
  if (!options.strict) {
    body = normalizeTag(body);
  }
  var str = "object " + body.object +
    "\ntype " + body.type +
    "\ntag " + body.tag +
    "\ntagger " + formatPerson(body.tagger) +
    "\n\n" + body.message;
    var buff = new Buffer(str);
    options.size = buff.length;
    options.type = 'tag';
    return streamifier.createReadStream(buff).pipe(blobWriter(options));
};

// Adapted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
var commitWriter = function (body, options) {
  options = optionChecker(options);
  if (!options.strict) {
    body = normalizeCommit(body);
  }
  var str = "tree " + body.tree;
  for (var i = 0, l = body.parents.length; i < l; ++i) {
    str += "\nparent " + body.parents[i];
  }
  str += "\nauthor " + formatPerson(body.author) +
         "\ncommitter " + formatPerson(body.committer) +
         "\n\n" + body.message;
  var buff = new Buffer(str);
  options.size = buff.length;
  options.type = 'commit';
  return streamifier.createReadStream(buff).pipe(blobWriter(options));
};

// Lifted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function decodePerson(string) {
  var match = string.match(/^([^<]*) <([^>]*)> ([^ ]*) (.*)$/);
  if (!match) throw new Error("Improperly formatted person string");
  return {
    name: match[1],
    email: match[2],
    date: {
      seconds: parseInt(match[3], 10),
      offset: parseInt(match[4], 10) / 100 * -60
    }
  };
}

// Adapted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function commitParser(body) {
  var i = 0;
  var start;
  var key;
  var parents = [];
  var commit = {
    tree: "",
    parents: parents,
    author: "",
    committer: "",
    message: ""
  };
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    key = body.slice(start, i++).toString();
    start = i;
    i = indexOf(body, 0x0a, start);
    if (i < 0) throw new SyntaxError("Missing linefeed");
    var value = body.slice(start, i++).toString();
    if (key === "parent") {
      parents.push(value);
    }
    else {
      if (key === "author" || key === "committer") {
        value = decodePerson(value);
      }
      commit[key] = value;
    }
  }
  i++;
  commit.message = body.slice(i, body.length).toString();
  return commit;
}

commitReader = function () {
  return genericReader(commitParser);
};

// Adapted from: https://github.com/creationix/js-git/blob/master/lib/object-codec.js
// MIT Licensed
function tagParser(body) {
  var i = 0;
  var start;
  var key;
  var tag = {};
  while (body[i] !== 0x0a) {
    start = i;
    i = indexOf(body, 0x20, start);
    if (i < 0) throw new SyntaxError("Missing space");
    key = body.slice(start, i++).toString();
    start = i;
    i = indexOf(body, 0x0a, start);
    if (i < 0) throw new SyntaxError("Missing linefeed");
    var value = body.slice(start, i++).toString();
    if (key === "tagger") value = decodePerson(value);
    tag[key] = value;
  }
  i++;
  tag.message = body.slice(i, body.length).toString();
  return tag;
}

tagReader = function () {
  return genericReader(tagParser);
};

// Lifted from: https://github.com/creationix/js-git/blob/master/mixins/formats.js
// MIT Licensed
function normalizeTree(body) {
  var type = body && typeof body;
  if (type !== "object") {
    throw new TypeError("Tree body must be array or object");
  }
  var tree = {}, i, l, entry;
  // If array form is passed in, convert to object form.
  if (Array.isArray(body)) {
    for (i = 0, l = body.length; i < l; i++) {
      entry = body[i];
      tree[entry.name] = {
        mode: entry.mode,
        hash: entry.hash
      };
    }
  }
  else {
    var names = Object.keys(body);
    for (i = 0, l = names.length; i < l; i++) {
      var name = names[i];
      entry = body[name];
      tree[name] = {
        mode: entry.mode,
        hash: entry.hash
      };
    }
  }
  return tree;
}

// Lifted from: https://github.com/creationix/js-git/blob/master/mixins/formats.js
// MIT Licensed
function normalizeCommit(body) {
  if (!body || typeof body !== "object") {
    throw new TypeError("Commit body must be an object");
  }
  if (!(body.tree && body.author && body.message)) {
    throw new TypeError("Tree, author, and message are required for commits");
  }
  var parents = body.parents || (body.parent ? [ body.parent ] : []);
  if (!Array.isArray(parents)) {
    throw new TypeError("Parents must be an array");
  }
  var author = normalizePerson(body.author);
  var committer = body.committer ? normalizePerson(body.committer) : author;
  return {
    tree: body.tree,
    parents: parents,
    author: author,
    committer: committer,
    message: body.message
  };
}

// Lifted from: https://github.com/creationix/js-git/blob/master/mixins/formats.js
// MIT Licensed
function normalizeTag(body) {
  if (!body || typeof body !== "object") {
    throw new TypeError("Tag body must be an object");
  }
  if (!(body.object && body.type && body.tag && body.tagger && body.message)) {
    throw new TypeError("Object, type, tag, tagger, and message required");
  }
  return {
    object: body.object,
    type: body.type,
    tag: body.tag,
    tagger: normalizePerson(body.tagger),
    message: body.message
  };
}

// Lifted from: https://github.com/creationix/js-git/blob/master/mixins/formats.js
// MIT Licensed
function normalizePerson(person) {
  if (!person || typeof person !== "object") {
    throw new TypeError("Person must be an object");
  }
  if (typeof person.name !== "string" || typeof person.email !== "string") {
    throw new TypeError("Name and email are required for person fields");
  }
  return {
    name: person.name,
    email: person.email,
    date: person.date || new Date()
  };
}

module.exports = exports = {
  blobWriter: blobWriter,
  blobReader: blobReader,
  treeWriter: treeWriter,
  treeReader: treeReader,
  commitWriter: commitWriter,
  commitReader: commitReader,
  tagWriter: tagWriter,
  tagReader: tagReader,
  gitModes: gitModes
};
