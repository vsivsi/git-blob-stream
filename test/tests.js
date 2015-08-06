/***************************************************************************
###  Copyright (C) 2015 by Vaughn Iverson
###  git-blob-stream is free software released under the MIT/X11 license.
###  See included LICENSE file for details.
***************************************************************************/

var assert = require('assert'),
    fs = require('fs'),
    crypto = require('crypto'),
    gbs = require('../'),
    Step = require('step'),
    ipsum = __dirname + '/fixtures/ipsum.txt',
    ipsumHash = '668e29c2db77e9dfe7c914700be7df724807c648',
    ipsumLength = 74121,
    tree = __dirname + '/fixtures/tree.blob',
    commit = __dirname + '/fixtures/commit.blob',
    tag = __dirname + '/fixtures/tag.blob';

var repo = {};
require('js-git/mixins/mem-db')(repo);
require('js-git/mixins/formats')(repo);

describe('Git blob streams', function () {
  var testBlob = "Hello World\n",
      testTree = {
        "greeting.txt": { mode: gbs.gitModes.file, hash: null }
      },
      testCommit = {
        tree: null,
        author: {
          name: "Bozo the Clown",
          email: "bozo@clowns.com"
        },
        message: "LOL; JK, KThxBye\n"
      },
      testTag = {
        object: null,
        type: "commit",
        tag: "theBest",
        tagger: {
          name: "Fizbo the Clown",
          email: "fizbo@clowns.com"
        },
        message: "The best commit ever!\n"
      };

  var blobHash, treeHash, commitHash, tagHash;
  before(function (done) {
    Step(
      function () {
        repo.saveAs("blob", "Hello World\n", this);
      },
      function (err, hash) {
        if (err) throw err;
        blobHash = hash;
        testTree["greeting.txt"].hash = blobHash;
        repo.saveAs("tree", testTree, this);
      },
      function (err, hash) {
        if (err) throw err;
        treeHash = hash;
        testCommit.tree = treeHash;
        repo.saveAs("commit", testCommit, this.parallel());
        repo.loadAs("tree", treeHash, this.parallel());
      },
      function (err, hash, tree) {
        if (err) throw err;
        commitHash = hash;
        testTree = tree;
        // console.dir(testTree);
        testTag.object = commitHash;
        repo.saveAs("tag", testTag, this.parallel());
        repo.loadAs("commit", commitHash, this.parallel());
      },
      function (err, hash, commit) {
        if (err) throw err;
        tagHash = hash;
        testCommit = commit;
        // console.dir(testCommit);
        repo.loadAs("tag", tagHash, this);
      },
      function (err, tag) {
        if (err) throw err;
        testTag = tag;
        // console.dir(testTag);
        // console.log("blobHash:", blobHash);
        // console.log("treeHash:", treeHash);
        // console.log("commitHash:", commitHash);
        // console.log("tagHash:", tagHash);
        done();
      }
    );
  });
  it('should pass data through a pipeline correctly', function (done) {
    var hashCalled = false;
    var sha1Cb = function (err, ret) {
      if (err) throw err;
      hashCalled = true;
      assert.equal(ret.hash.toString('hex'), blobHash);
      assert.equal(ret.size, testBlob.length);
    };
    var input = gbs.blobWriter({type: 'blob', size: testBlob.length }, sha1Cb);
    var output = input.pipe(gbs.blobReader());
    input.end(new Buffer(testBlob));
    var msgOut = new Buffer(0);
    output.on('data', function (chunk) {
      msgOut = Buffer.concat([msgOut, chunk]);
    });
    output.on('end', function () {
      assert.equal(msgOut.toString(), testBlob);
      assert(hashCalled);
      done();
    });
    output.on('error', function (e) {
      console.warn("Error in pipeline", e);
      assert(false);
    });
  });

  describe('blobWriter', function () {
    it('should work as a file encoder', function (done) {
      var hashCalled = false;
      var sha1Cb = function (err, ret) {
        if (err) throw err;
        hashCalled = true;
        assert.equal(ret.hash.toString('hex'), ipsumHash);
        assert.equal(ret.size, ipsumLength);
      };
      var input = fs.createReadStream(ipsum);
      var output = fs.createWriteStream(ipsum + ".blob");
      var writer = gbs.blobWriter({type: 'blob', size: ipsumLength}, sha1Cb);
      output.on('close', function () {
        assert(hashCalled);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
      input.pipe(writer).pipe(output);
    });

    it('should work as a file encoder without size option', function (done) {
      var hashCalled = false;
      var sha1Cb = function (err, ret) {
        if (err) throw err;
        hashCalled = true;
        assert.equal(ret.hash.toString('hex'), ipsumHash);
        assert.equal(ret.size, ipsumLength);
      };
      var input = fs.createReadStream(ipsum);
      var output = fs.createWriteStream(ipsum + ".blob");
      var writer = gbs.blobWriter({type: 'blob'}, sha1Cb);
      output.on('close', function () {
        assert(hashCalled);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
      input.pipe(writer).pipe(output);
    });

    it('should work as a hex string hash calculator', function (done) {
      var callbackCalled = false;
      var input = fs.createReadStream(ipsum);
      var sha1Cb = function (err, ret) {
        if (err) throw err;
        callbackCalled = true;
        assert.equal(ret.hash, ipsumHash);
        assert.equal(ret.size, ipsumLength);
      };
      var writer = gbs.blobWriter({type: 'blob', size: ipsumLength, noOutput: true }, sha1Cb);
      var pipeline = input.pipe(writer);
      pipeline.on('end', function (e) {
        assert(callbackCalled);
        done();
      });
      pipeline.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });
  });

  describe('blobReader', function () {
    it('should work as a file decoder', function (done) {
      var input = fs.createReadStream(ipsum + ".blob");
      var reader = gbs.blobReader();
      var sha1 = crypto.createHash('sha1');
      reader.on('data', function (chunk) {
        sha1.update(chunk);
      });
      reader.on('end', function () {
        assert.equal(sha1.digest('hex'), '0864e5f892af90df553f1cddc14bf6d00215e3d2');
        done();
      });
      reader.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
      input.pipe(reader);
    });

    it('should work as a header decoder', function (done) {
      var callbackCalled = false;
      headerCb = function (err, ret) {
        if (err) throw err;
        callbackCalled = true;
        assert.equal(ret.type, 'blob');
        assert.equal(ret.size, ipsumLength);
      };
      var input = fs.createReadStream(ipsum + ".blob");
      var reader = gbs.blobReader({ noOutput: true }, headerCb);
      reader.on('end', function () {
        assert(callbackCalled);
        done();
      });
      reader.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
      input.pipe(reader);
    });
  });

  describe('treeWriter', function () {
    it('should correctly write a tree blob', function (done) {
      var hashCalled = false;
      var hashFunc = function (err, ret) {
        if (err) throw err;
        assert.equal(ret.hash, treeHash);
        assert.deepEqual(ret.tree, testTree);
        hashCalled = true;
      };
      var output = fs.createWriteStream(tree);
      var input = gbs.treeWriter(testTree, hashFunc);
      input.pipe(output);
      output.on('close', function () {
        assert(hashCalled);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });
    it('should correctly calculate tree blob hash without output', function (done) {
      var hashCalled = false;
      var hashFunc = function (err, ret) {
        if (err) throw err;
        assert.equal(ret.hash, treeHash);
        assert.deepEqual(ret.tree, testTree);
        hashCalled = true;
      };
      var input = gbs.treeWriter(testTree, {noOutput: true}, hashFunc);
      input.on('end', function () {
        assert(hashCalled);
        done();
      });
      input.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });
  });

  describe('treeReader', function () {
    it('should correctly read a tree blob', function (done) {
      var input = fs.createReadStream(tree);
      var output = input.pipe(gbs.treeReader());
      output.on('data', function (data) {
        assert.equal(typeof data, 'object');
        assert.deepEqual(data, testTree);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });

    it('should correctly read a tree blob with callback', function (done) {
      var input = fs.createReadStream(tree);
      var callbackCalled = false;
      var readerCallback = function (err, data) {
        if (err) throw err;
        callbackCalled = true;
        assert.equal(typeof data, 'object');
        assert.deepEqual(data, testTree);
      };
      var output = input.pipe(gbs.treeReader(readerCallback));
      output.on('end', function (data) {
        assert(callbackCalled);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });
  });

  describe('commitWriter', function () {
    it('should correctly write a commit blob', function (done) {
      var hashCalled = false;
      var hashFunc = function (err, ret) {
        if (err) throw err;
        assert.equal(ret.hash, commitHash);
        assert.deepEqual(ret.commit, testCommit);
        hashCalled = true;
      };
      var output = fs.createWriteStream(commit);
      var input = gbs.commitWriter(testCommit, hashFunc);
      input.pipe(output);
      output.on('close', function () {
        assert(hashCalled);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });
    it('should correctly calculate a commit blob hash without output', function (done) {
      var hashCalled = false;
      var hashFunc = function (err, ret) {
        if (err) throw err;
        assert.equal(ret.hash, commitHash);
        hashCalled = true;
      };
      var input = gbs.commitWriter(testCommit, {noOutput: true}, hashFunc);
      input.on('end', function () {
        assert(hashCalled);
        done();
      });
      input.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });
  });

  describe('commitReader', function () {
    it('should correctly read a commit blob', function (done) {
      var input = fs.createReadStream(commit);
      var output = input.pipe(gbs.commitReader());
      output.on('data', function (data) {
        assert.equal(typeof data, 'object');
        assert.deepEqual(data, testCommit);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });

    it('should correctly read a commit blob with callback', function (done) {
      var input = fs.createReadStream(commit);
      var callbackCalled = false;
      var readerCallback = function (err, data) {
        if (err) throw err;
        callbackCalled = true;
        assert.equal(typeof data, 'object');
        assert.deepEqual(data, testCommit);
      };
      var output = input.pipe(gbs.commitReader(readerCallback));
      output.on('end', function (data) {
        assert(callbackCalled);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });
  });

  describe('tagWriter', function () {
    it('should correctly write a tag blob', function (done) {
      var hashCalled = false;
      var hashFunc = function (err, ret) {
        if (err) throw err;
        assert.equal(ret.hash, tagHash);
        assert.deepEqual(ret.tag, testTag);
        hashCalled = true;
      };
      var output = fs.createWriteStream(tag);
      var input = gbs.tagWriter(testTag, hashFunc);
      input.pipe(output);
      output.on('close', function () {
        assert(hashCalled);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });

    it('should correctly calculate tag blob hash without output', function (done) {
      var hashCalled = false;
      var hashFunc = function (err, ret) {
        if (err) throw err;
        assert.equal(ret.hash, tagHash);
        hashCalled = true;
      };
      var input = gbs.tagWriter(testTag, {noOutput: true}, hashFunc);
      input.on('end', function () {
        assert(hashCalled);
        done();
      });
      input.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });
  });

  describe('tagReader', function () {
    it('should correctly read a tag blob', function (done) {
      var input = fs.createReadStream(tag);
      var output = input.pipe(gbs.tagReader());
      output.on('data', function (data) {
        assert.equal(typeof data, 'object');
        assert.deepEqual(data, testTag);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });

    it('should correctly read a tag blob with callback', function (done) {
      var input = fs.createReadStream(tag);
      var callbackCalled = false;
      var readerCallback = function (err, data) {
        if (err) throw err;
        callbackCalled = true;
        assert.equal(typeof data, 'object');
        assert.deepEqual(data, testTag);
      };
      var output = input.pipe(gbs.tagReader(readerCallback));
      output.on('end', function (data) {
        assert(callbackCalled);
        done();
      });
      output.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });
  });

  after(function (done) {
    fs.unlinkSync(tag);
    fs.unlinkSync(commit);
    fs.unlinkSync(tree);
    fs.unlinkSync(ipsum + ".blob");
    done();
  });
});
