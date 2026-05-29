import { useRef, useState, useEffect } from 'react';
import { api } from '../api/client';
import { Alert } from './ui';

/**
 * AI-assisted facial scan widget (Amazon Rekognition on the backend).
 * Tries the live webcam; if unavailable, falls back to a file upload.
 * Sends the captured frame to POST /api/facial/verify and reports the verdict.
 *
 * Props:
 *   voterId   - optional; required when staff verify a voter (omitted for self)
 *   onResult  - callback(result) after a scan completes
 */
export default function FacialCapture({ voterId, onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => () => stopCamera(), []);

  async function startCamera() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch {
      setError('Camera unavailable — you can upload a photo instead.');
    }
  }

  function stopCamera() {
    const v = videoRef.current;
    if (v && v.srcObject) {
      v.srcObject.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    setStreaming(false);
  }

  async function captureFromVideo() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const w = v.videoWidth || 480;
    const h = v.videoHeight || 360;
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(v, 0, 0, w, h);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    setPreviewUrl(c.toDataURL('image/jpeg'));
    stopCamera();
    await submit(blob, 'capture.jpg');
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    await submit(file, file.name);
  }

  async function submit(blob, filename) {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('image', blob, filename);
      if (voterId) fd.append('voterId', voterId);
      const out = await api.upload('/facial/verify', fd);
      setResult(out);
      onResult?.(out);
    } catch (err) {
      setError(err.message || 'Facial scan failed');
    } finally {
      setBusy(false);
    }
  }

  const scan = result?.scan;

  return (
    <div>
      {error && <Alert type="error">{error}</Alert>}

      <div className="facial-stage">
        {previewUrl ? (
          <img src={previewUrl} alt="captured face" />
        ) : streaming ? (
          <video ref={videoRef} playsInline muted />
        ) : (
          <div style={{ padding: 30 }}>
            <div style={{ fontSize: 40 }}>📷</div>
            <p className="muted" style={{ margin: '8px 0 0' }}>
              Position the face within the frame in good lighting.
            </p>
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div className="toolbar" style={{ justifyContent: 'center', margin: 0 }}>
          {!streaming && !busy && (
            <button type="button" className="btn" onClick={startCamera}>
              Start camera
            </button>
          )}
          {streaming && (
            <button type="button" className="btn gold" onClick={captureFromVideo}>
              Capture & scan
            </button>
          )}
          <label className="btn secondary" style={{ cursor: 'pointer' }}>
            Upload photo
            <input type="file" accept="image/png,image/jpeg" hidden onChange={onFile} />
          </label>
          {previewUrl && !busy && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setPreviewUrl('');
                setResult(null);
              }}
            >
              Retake
            </button>
          )}
        </div>

        {busy && (
          <div className="toolbar" style={{ justifyContent: 'center', margin: 0 }}>
            <div className="spinner" /> <span className="muted">Analysing face…</span>
          </div>
        )}
      </div>

      {scan && (
        <div style={{ marginTop: 14 }}>
          <Alert type={scan.status === 'PASS' ? 'success' : 'error'}>
            {scan.status === 'PASS'
              ? `Face verified (${scan.provider}). Biometric status: ${result.biometricStatus}.`
              : `Scan failed: ${scan.reasons?.join('; ') || 'no valid face detected'}.`}
          </Alert>
          <div className="scan-meter">
            <div className="m"><b>{scan.confidence}%</b><span>Face confidence</span></div>
            <div className="m"><b>{scan.livenessScore}</b><span>Liveness</span></div>
            <div className="m"><b>{scan.similarityScore}</b><span>Image quality</span></div>
            <div className="m"><b>{scan.faceCount}</b><span>Faces</span></div>
          </div>
          {result.ledger?.txRef && (
            <p className="muted" style={{ marginTop: 10, textAlign: 'center' }}>
              Anchored on ledger · <span className="mono">{result.ledger.txRef}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
