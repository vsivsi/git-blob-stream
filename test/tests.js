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
    var sha1Cb = function (ret) {
      hashCalled = true;
      assert.equal(ret.hash.toString('hex'), blobHash);
      assert.equal(ret.size, testBlob.length);
    };
    var input = gbs.blobWriter({type: 'blob', size: testBlob.length, hashCallback: sha1Cb});
    var output = input.pipe(gbs.blobReader());
    input.end(new Buffer(testBlob));
    var msgOut = new Buffer(0);
    output.on('data', function (chunk) {
      msgOut = Buffer.concat([msgOut, chunk]);
    });
    output.on('end', function () {
      assert(msgOut.toString() === testBlob);
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
      var sha1Cb = function (ret) {
        hashCalled = true;
        assert.equal(ret.hash.toString('hex'), ipsumHash);
        assert.equal(ret.size, ipsumLength);
      };
      var input = fs.createReadStream(ipsum);
      var output = fs.createWriteStream(ipsum + ".blob");
      var writer = gbs.blobWriter({type: 'blob', size: ipsumLength, hashCallback: sha1Cb});
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
      var sha1Cb = function (ret) {
        hashCalled = true;
        assert.equal(ret.hash.toString('hex'), ipsumHash);
        assert.equal(ret.size, ipsumLength);
      };
      var input = fs.createReadStream(ipsum);
      var output = fs.createWriteStream(ipsum + ".blob");
      var writer = gbs.blobWriter({type: 'blob', hashCallback: sha1Cb});
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

    it('should work as a hash calculator', function (done) {
      var input = fs.createReadStream(ipsum);
      var writer = gbs.blobWriter({type: 'blob', size: ipsumLength, hashFormat: 'buffer'});
      var pipeline = input.pipe(writer);
      var ret = null;
      pipeline.on('data', function (data) {
        ret = data;
      });
      pipeline.on('end', function () {
        assert.equal(ret.hash.toString('hex'), ipsumHash);
        assert.equal(ret.size, ipsumLength);
        done();
      });
      pipeline.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });

    it('should work as a hex string hash calculator', function (done) {
      var input = fs.createReadStream(ipsum);
      var writer = gbs.blobWriter({type: 'blob', size: ipsumLength, hashFormat: 'hex' });
      var pipeline = input.pipe(writer);
      var ret = null;
      pipeline.on('data', function (data) {
        ret = data;
      });
      pipeline.on('end', function () {
        assert.equal(ret.hash, ipsumHash);
        assert.equal(ret.size, ipsumLength);
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
        assert(sha1.digest('hex') === '0864e5f892af90df553f1cddc14bf6d00215e3d2');
        done();
      });
      reader.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
      input.pipe(reader);
    });

    it('should work as a header decoder', function (done) {
      var input = fs.createReadStream(ipsum + ".blob");
      var reader = gbs.blobReader({ header: true });
      reader.on('data', function (header) {
        assert.equal(header.type, 'blob');
        assert.equal(header.size, 74121);
      });
      reader.on('end', function () {
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
      var hashFunc = function (ret) {
        assert.equal(ret.hash, treeHash);
        hashCalled = true;
      };
      var output = fs.createWriteStream(tree);
      var input = gbs.treeWriter(testTree, { hashFormat: 'hex', hashCallback: hashFunc });
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
  });

  describe('treeReader', function () {
    it('should correctly read a tree blob', function (done) {
      var input = fs.createReadStream(tree);
      var output = input.pipe(gbs.treeReader());
      output.on('data', function (data) {
        assert(typeof data === 'object');
        assert.deepEqual(data, testTree);
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
      var hashFunc = function (ret) {
        assert.equal(ret.hash, commitHash);
        hashCalled = true;
      };
      var output = fs.createWriteStream(commit);
      var input = gbs.commitWriter(testCommit, { hashFormat: 'hex', hashCallback: hashFunc });
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
  });

  describe('commitReader', function () {
    it('should correctly read a commit blob', function (done) {
      var input = fs.createReadStream(commit);
      var output = input.pipe(gbs.commitReader());
      output.on('data', function (data) {
        assert(typeof data === 'object');
        assert.deepEqual(data, testCommit);
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
      var hashFunc = function (ret) {
        assert.equal(ret.hash, tagHash);
        hashCalled = true;
      };
      var output = fs.createWriteStream(tag);
      var input = gbs.tagWriter(testTag, { hashFormat: 'hex', hashCallback: hashFunc });
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
  });

  describe('tagReader', function () {
    it('should correctly read a tag blob', function (done) {
      var input = fs.createReadStream(tag);
      var output = input.pipe(gbs.tagReader());
      output.on('data', function (data) {
        assert(typeof data === 'object');
        assert.deepEqual(data, testTag);
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
