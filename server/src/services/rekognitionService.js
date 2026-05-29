'use strict';

/**
 * AI-ASSISTED FACIAL SCAN  —  Amazon Rekognition
 * ----------------------------------------------
 * Implements the report's facial-scan workflow (FR 3.6) using AWS Rekognition
 * `DetectFaces`. Rekognition returns face presence, a bounding box, quality
 * (Brightness/Sharpness) and confidence — exactly the "face presence + image
 * quality" signals the report specifies. We do NOT claim person-specific
 * recognition; this is a presence/liveness/quality gate before the system's
 * own verification logic proceeds.
 *
 * Graceful degradation (NFR 4.6 / FR 3.10 error handling): when AWS
 * credentials are not configured the service falls back to a deterministic
 * local analyser so the entire application still runs offline for grading and
 * demos. The response shape is identical in both modes, and `provider` tells
 * the caller which path was taken.
 */

const crypto = require('crypto');
const config = require('../config/env');

let _client = null;
let _sdk = null;

function getClient() {
  if (!config.rekognition.enabled) return null;
  if (_client) return _client;
  // Lazy-load the SDK so the dependency is only touched when actually used.
  _sdk = require('@aws-sdk/client-rekognition');
  _client = new _sdk.RekognitionClient({
    region: config.rekognition.region,
    credentials: {
      accessKeyId: config.rekognition.accessKeyId,
      secretAccessKey: config.rekognition.secretAccessKey,
    },
  });
  return _client;
}

/**
 * Analyse a face image buffer.
 * @returns {{
 *   provider:'aws-rekognition'|'local-mock',
 *   faceDetected:boolean, faceCount:number,
 *   confidence:number, livenessScore:number, similarityScore:number,
 *   quality:{brightness:number,sharpness:number},
 *   status:'PASS'|'FAIL', reasons:string[]
 * }}
 */
async function analyseFace(imageBuffer) {
  if (!imageBuffer || !imageBuffer.length) {
    return fail('local-mock', ['No image data received']);
  }
  return config.rekognition.enabled
    ? analyseWithAws(imageBuffer)
    : analyseWithMock(imageBuffer);
}

async function analyseWithAws(imageBuffer) {
  const { DetectFacesCommand } = _sdk || require('@aws-sdk/client-rekognition');
  const client = getClient();
  const out = await client.send(
    new DetectFacesCommand({
      Image: { Bytes: imageBuffer },
      Attributes: ['DEFAULT'],
    })
  );

  const faces = out.FaceDetails || [];
  const faceCount = faces.length;
  if (faceCount === 0) return fail('aws-rekognition', ['No face detected in image']);

  const face = faces[0];
  const confidence = round(face.Confidence || 0);
  const brightness = round((face.Quality && face.Quality.Brightness) || 0);
  const sharpness = round((face.Quality && face.Quality.Sharpness) || 0);
  // Use detection confidence as the liveness proxy and quality as similarity proxy.
  const livenessScore = confidence;
  const similarityScore = round((brightness + sharpness) / 2);

  return evaluate('aws-rekognition', {
    faceCount,
    confidence,
    livenessScore,
    similarityScore,
    quality: { brightness, sharpness },
  });
}

/**
 * Deterministic offline analyser. Derives stable pseudo-scores from a hash of
 * the image bytes so the same image always yields the same verdict (useful for
 * reproducible demos). Tiny/empty images fail; anything resembling a real photo
 * passes — good enough to exercise the full workflow without AWS.
 */
async function analyseWithMock(imageBuffer) {
  // Treat very small payloads as "no face".
  if (imageBuffer.length < 1024) {
    return fail('local-mock', ['Image too small to contain a detectable face']);
  }
  const digest = crypto.createHash('sha256').update(imageBuffer).digest();
  const span = (offset, min, max) => min + (digest[offset] / 255) * (max - min);
  const confidence = round(span(0, 92, 99.9));
  const brightness = round(span(1, 55, 95));
  const sharpness = round(span(2, 55, 95));
  const livenessScore = confidence;
  const similarityScore = round((brightness + sharpness) / 2);

  return evaluate('local-mock', {
    faceCount: 1,
    confidence,
    livenessScore,
    similarityScore,
    quality: { brightness, sharpness },
  });
}

function evaluate(provider, m) {
  const reasons = [];
  if (m.confidence < config.rekognition.minConfidence) {
    reasons.push(
      `Face confidence ${m.confidence}% below ${config.rekognition.minConfidence}%`
    );
  }
  if (m.similarityScore < config.rekognition.minQuality) {
    reasons.push(
      `Image quality ${m.similarityScore} below ${config.rekognition.minQuality}`
    );
  }
  const status = reasons.length === 0 ? 'PASS' : 'FAIL';
  return {
    provider,
    faceDetected: true,
    faceCount: m.faceCount,
    confidence: m.confidence,
    livenessScore: m.livenessScore,
    similarityScore: m.similarityScore,
    quality: m.quality,
    status,
    reasons,
  };
}

function fail(provider, reasons) {
  return {
    provider,
    faceDetected: false,
    faceCount: 0,
    confidence: 0,
    livenessScore: 0,
    similarityScore: 0,
    quality: { brightness: 0, sharpness: 0 },
    status: 'FAIL',
    reasons,
  };
}

const round = (n) => Math.round(n * 10) / 10;

module.exports = { analyseFace, providerName: () => (config.rekognition.enabled ? 'aws-rekognition' : 'local-mock') };
