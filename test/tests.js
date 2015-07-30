/***************************************************************************
###  Copyright (C) 2015 by Vaughn Iverson
###  git-blob-stream is free software released under the MIT/X11 license.
###  See included LICENSE file for details.
***************************************************************************/

var assert = require('assert'),
    fs = require('fs'),
    crypto = require('crypto'),
    gitBlobStream = require('../'),
    ipsum = __dirname + '/fixtures/ipsum.txt';

describe('Git blob streams', function () {
  it('should pass data through a pipeline correctly', function (done) {
    var msg = "This is the message text!\n";
    var hashCalled = false;
    var sha1Cb = function (hash) {
      hashCalled = true;
      assert(Buffer.compare(hash, new Buffer('327b85ca3f29975db856a0477278671456ff908b','hex')) === 0);
    };
    var input = gitBlobStream.blobWriter({type: 'blob', size: msg.length, hashCallback: sha1Cb});
    var output = input.pipe(gitBlobStream.blobReader());
    input.end(new Buffer(msg));
    var msgOut = new Buffer(0);
    output.on('data', function (chunk) {
      msgOut = Buffer.concat([msgOut, chunk]);
    });
    output.on('end', function () {
      assert(msgOut.toString() === msg);
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
      var sha1Cb = function (hash) {
        hashCalled = true;
        assert(Buffer.compare(hash, new Buffer('Zo4pwtt36d/nyRRwC+ffckgHxkg=','base64')) === 0);
      };
      var input = fs.createReadStream(ipsum);
      var output = fs.createWriteStream(ipsum + ".blob");
      var writer = gitBlobStream.blobWriter({type: 'blob', size: 74121, hashCallback: sha1Cb});
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
      var writer = gitBlobStream.blobWriter({type: 'blob', size: 74121, hashFormat: 'hex' });
      var pipeline = input.pipe(writer);
      var hash = '';
      pipeline.on('data', function (chunk) {
        hash = hash + chunk;
      });
      pipeline.on('end', function () {
        assert(hash === '668e29c2db77e9dfe7c914700be7df724807c648');
        done();
      });
      pipeline.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });

    it('should work as a base64 hash calculator', function (done) {
      var input = fs.createReadStream(ipsum);
      var writer = gitBlobStream.blobWriter({type: 'blob', size: 74121, hashFormat: 'base64'});
      var pipeline = input.pipe(writer);
      var hash = '';
      pipeline.on('data', function (chunk) {
        hash = hash + chunk;
      });
      pipeline.on('end', function (chunk) {
        assert(hash === 'Zo4pwtt36d/nyRRwC+ffckgHxkg=');
        done();
      });
      pipeline.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
    });

    it('should work as a buffer hash calculator', function (done) {
      var input = fs.createReadStream(ipsum);
      var writer = gitBlobStream.blobWriter({type: 'blob', size: 74121, hashFormat: 'buffer'});
      var pipeline = input.pipe(writer);
      var hash = new Buffer(0);
      pipeline.on('data', function (chunk) {
        hash = Buffer.concat([hash, chunk]);
      });
      pipeline.on('end', function () {
        assert(Buffer.compare(hash, new Buffer('Zo4pwtt36d/nyRRwC+ffckgHxkg=','base64')) === 0);
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
      var reader = gitBlobStream.blobReader();
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

    it('should work as a file decoder with retained header', function (done) {
      var input = fs.createReadStream(ipsum + ".blob");
      var reader = gitBlobStream.blobReader({ header: true });
      var sha1 = crypto.createHash('sha1');
      reader.on('data', function (chunk) {
        sha1.update(chunk);
      });
      reader.on('end', function () {
        assert(sha1.digest('hex') === '668e29c2db77e9dfe7c914700be7df724807c648');
        done();
      });
      reader.on('error', function (e) {
        console.warn("Error in pipeline", e);
        assert(false);
      });
      input.pipe(reader);
    });
  });

  after(function (done) {
    fs.unlinkSync(ipsum + ".blob");
    done();
  });
});
