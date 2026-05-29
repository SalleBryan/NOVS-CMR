'use strict';

/** Wrap async route handlers so thrown errors reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Throw this for clean, status-coded API errors. */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Mongo duplicate key -> 409 with a friendly message.
  if (err && err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate value',
      details: err.keyValue,
    });
  }
  // Mongoose validation -> 400.
  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.errors });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = { asyncHandler, ApiError, notFound, errorHandler };
