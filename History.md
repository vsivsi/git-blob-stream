##### .NEXT

* `gbs.blobWriter()` now has an option `hashFormat` with valid values of 'hex', 'base64 or 'binary', with default of 'hex'.  'binary' returns a Buffer.
* `gbs.blobWriter()` setting `hashCallback` is now optional. If omitted, the output stream will be the SHA1 hash in the format selected with the `hashFormat` option.

##### 0.0.1

* Initial revision
