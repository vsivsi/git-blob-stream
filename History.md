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
