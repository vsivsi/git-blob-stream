##### 0.0.11

* Fixed bug in *Writer calls when `noOutput: true`

##### 0.0.10

* All callbacks now follow standard node signature `function (err, result) {}`

##### 0.0.9

* `hashCallback` option has been eliminated from all *Writer calls, in favor of an optional callback as the last parameter.
* `blobReader` also now accepts an optional callback as the last parameter for returning header information.
* Both `blobReader` and the *Writer calls no longer output objects under any circumstances.
* `treeReader`, `commitReader` and `tagReader` now accept an optional callback. If provided, the callback is called with the output. If no callback is provided, then the output can be read from the stream as an object as before.
* `noOutput` option has been added to all *Writer calls as well as `blobReader` to allow for "callback only" operation.
* The *Writer calls no longer have a `hashFormat` option. All hashes are now returned to the callback in `'hex'` format.

##### 0.0.8

* `size` is now optional for `gbs.blobWriter()`. It is more efficient to provide it (if known) because otherwise a blob sized buffer needs to be built.
* The `hashCallback` and/or streaming hash output now returns an object containing `{ hash: <hashInReqFormat>, size: <sizeOfBlobData>}`
* Docs and Tests were updated

##### 0.0.7

* Tree, commit and tag input data structures are now more permissive of missing fields unless the `strict` option is used with the corresponding `*Writer()` call.
* The `header` option to `gbs.blobReader()` now causes a single parsed header object to be written to the output stream.
* All `console.error()` calls now `throw`

##### 0.0.6

* Added support for reading and writing commit and tag blobs. e.g. `gbs.commitReader()` and `gbs.tagWriter()`
* Updated Copyright and License information to acknowledge git-object code integrated from @creationix / js-git

##### 0.0.5

* SHA1 hash output 'binary' is now 'buffer', returns a buffer and is the default. 'hex' now returns a string.
* 'base64' removed as a SHA1 hash output... You can always convert a buffer to one.
* Added `gbs.treeReader()` and `gbs.treeWriter()` for streaming to and from js-git style tree objects

##### 0.0.4

* `gbs.blobReader()` now supports a single option, `header` if truthy, causes the output stream to retain the git blob header indicating the type and size of the blob.

##### 0.0.3

* Erroneous duplicate release

##### 0.0.2

* `gbs.blobWriter()` now has an option `hashFormat` with valid values of 'hex', 'base64 or 'binary', with default of 'hex'.  'binary' returns a Buffer.
* `gbs.blobWriter()` setting `hashCallback` is now optional. If omitted, the output stream will be the SHA1 hash in the format selected with the `hashFormat` option.

##### 0.0.1

* Initial revision
