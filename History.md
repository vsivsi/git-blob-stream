##### .NEXT

* SHA1 hash output 'binary' is now 'buffer', returns a buffer and is the default. 'hex' and 'base64' now return strings.

##### 0.0.4

* `gbs.blobReader()` now supports a single option, `header` if truthy, causes the output stream to retain the git blob header indicating the type and size of the blob.

##### 0.0.3

* Erroneous duplicate release

##### 0.0.2

* `gbs.blobWriter()` now has an option `hashFormat` with valid values of 'hex', 'base64 or 'binary', with default of 'hex'.  'binary' returns a Buffer.
* `gbs.blobWriter()` setting `hashCallback` is now optional. If omitted, the output stream will be the SHA1 hash in the format selected with the `hashFormat` option.

##### 0.0.1

* Initial revision
