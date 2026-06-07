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
    <div className="my-3">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full max-w-[280px] rounded-sm border border-border bg-black"
        style={{ display: active && !captured ? 'block' : 'none' }}
      />
      <canvas ref={canvasRef} className="hidden" />

      {!active && !captured && (
        <button type="button" className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none mb-2" onClick={startCamera}>
          Open Camera for Selfie
        </button>
      )}

      {active && !captured && (
        <div className="flex flex-col items-center">
          <button type="button" className="inline-flex items-center justify-center gap-1.5 font-body font-semibold text-sm border-none rounded-sm px-5 py-2.5 cursor-pointer transition no-underline bg-pink text-white hover:bg-pink-dark hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(233,30,140,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none mt-2" onClick={capture}>
            Capture Selfie
          </button>
        </div>
      )}

      {captured && (
        <div className="flex flex-col items-center">
          <img src={captured} alt="Selfie" className="w-full max-w-[280px] rounded-sm border border-border" />
          <button type="button" className="bg-none border-none text-pink cursor-pointer text-sm font-body font-medium p-0 underline hover:text-pink-dark mt-2" onClick={retake}>
            Retake
          </button>
        </div>
      )}
    </div>
  );
}

export default SelfieCapture;
