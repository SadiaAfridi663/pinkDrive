import { useState, useRef } from 'react';

function SelfieCapture({ onCapture }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [active, setActive] = useState(false);
  const [captured, setCaptured] = useState(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setActive(true);
    } catch {
      alert('Camera access denied. Please allow camera access.');
    }
  };

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
    if (onCapture) onCapture(dataUrl);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActive(false);
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  return (
    <div className="selfie-capture">
      {!active && !captured && (
        <button type="button" className="verify-goto-login" onClick={startCamera} style={{ marginBottom: '0.5rem' }}>
          Open Camera for Selfie
        </button>
      )}

      {active && (
        <div className="selfie-preview">
          <video ref={videoRef} autoPlay playsInline className="selfie-video" />
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

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

export default SelfieCapture;
