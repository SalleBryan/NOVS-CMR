'use strict';

const multer = require('multer');

/**
 * Face images are kept in memory (never written to disk) and passed straight
 * to the Rekognition service as bytes. This keeps biometric data transient,
 * matching the privacy requirement (NFR 4.2) and the 90-day TTL on the
 * facial_verifications collection.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 }, // 6 MB max
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG or PNG images are accepted'));
  },
});

module.exports = { upload };
