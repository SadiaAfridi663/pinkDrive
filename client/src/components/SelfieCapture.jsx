import { useState, useRef, useEffect, useCallback } from 'react';

function SelfieCapture({ onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [captured, setCaptured] = useState(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setActive(true);
    } catch {
      alert('Camera access denied. Please allow camera access.');
    }
  };

  useEffect(() => {
    if (active && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [active]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');
    setCaptured(dataUrl);
    stopCamera();
    setActive(false);
    if (onCapture) onCapture(dataUrl);
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  return (
    <div className="selfie-capture">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="selfie-video"
        style={{ display: active && !captured ? 'block' : 'none' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {!active && !captured && (
        <button type="button" className="verify-goto-login" onClick={startCamera} style={{ marginBottom: '0.5rem' }}>
          Open Camera for Selfie
        </button>
      )}

      {active && !captured && (
        <div className="selfie-preview">
          <button type="button" className="verify-goto-login" onClick={capture} style={{ marginTop: '0.5rem' }}>
            Capture Selfie
          </button>
        </div>
      )}

      {captured && (
        <div className="selfie-preview">
          <img src={captured} alt="Selfie" className="selfie-image" />
          <button type="button" className="link-button" onClick={retake} style={{ marginTop: '0.5rem' }}>
            Retake
          </button>
        </div>
      )}
    </div>
  );
}

export default SelfieCapture;
