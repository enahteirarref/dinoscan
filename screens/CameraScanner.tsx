// src/components/CameraScanner.tsx
import React, { useState, useRef, useEffect } from "react";
import { Fossil } from "../types";

interface CameraScannerProps {
  onBack: () => void;
  onResult: (fossil: Fossil) => void;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ onBack, onResult }) => {
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Initialize camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        console.error("Error accessing camera:", err);
        alert("无法访问摄像头，请确保已授予权限，并使用 HTTPS 访问。");
      }
    }
    setupCamera();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function approxBase64Bytes(b64: string) {
    return Math.floor((b64.length * 3) / 4);
  }

  function captureCompressed(maxDim: number, quality: number) {
    const video = videoRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, base64: dataUrl.split(",")[1] };
  }

  const processImage = async (base64Data: string, imageUrl: string) => {
    setIsScanning(true);
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data, // 不带 data:image/... 前缀
          mimeType: "image/jpeg",
        }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`API ${resp.status}: ${text}`);
      }

      const data = await resp.json();

      // Get precise location at capture time
      let lat = 39.9042,
        lng = 116.4074;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, enableHighAccuracy: true })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // ignore
      }

      const fossilResult: Fossil = {
        id: Math.random().toString(36).slice(2, 11),
        name: data.Name || "未知标本",
        era: data.Era || "中生代",
        classification: data.Classification || "恐龙总目",
        length: data.Length || "待定",
        rarity: data.Rarity || "普通",
        matchConfidence: data.Confidence || 70,
        description: "经由 AI 视觉算法深度分析的实地采样标本。",
        note: data.Note || "标本特征正在进一步比对中。",
        imageUrl,
        timestamp: new Date().toISOString(),
        location: { lat, lng },
      };

      onResult(fossilResult);
    } catch (e: any) {
      console.error(e);
      alert("分析失败：\n\n" + String(e?.message || e));
    } finally {
      setIsScanning(false);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    // 第一次压缩：640px / 0.6
    let { dataUrl, base64 } = captureCompressed(640, 0.6);

    // 兜底再压一次：512px / 0.55（避免 413）
    const bytes = approxBase64Bytes(base64);
    if (bytes > 1.8 * 1024 * 1024) {
      ({ dataUrl, base64 } = captureCompressed(512, 0.55));
    }

    processImage(base64, dataUrl);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 直接把上传图片读成 base64（建议你后续也做压缩，这里先最小改动）
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      processImage(base64, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-screen w-full relative bg-black flex flex-col overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />

      <header className="relative z-10 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent pt-12">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        <div className="relative w-72 h-72 pointer-events-none">
          <div className={`absolute inset-0 scan-grid opacity-20 ${isScanning ? "animate-pulse scale-110" : ""}`}></div>
          <div className="absolute top-0 left-0 w-12 h-12 border-t-[3px] border-l-[3px] border-white rounded-tl-xl"></div>
          <div className="absolute top-0 right-0 w-12 h-12 border-t-[3px] border-r-[3px] border-white rounded-tr-xl"></div>
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[3px] border-l-[3px] border-white rounded-bl-xl"></div>
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[3px] border-r-[3px] border-white rounded-br-xl"></div>

          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-lg rounded-xl z-20">
              <div className="text-white font-bold flex flex-col items-center gap-4 text-center px-4">
                <div className="relative">
                  <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm tracking-widest uppercase text-primary">正在分析图像</p>
                  <p className="text-[10px] text-white/60 font-medium">请稍候…</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-10 px-8 pt-12 pb-16 flex justify-between items-center bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-14 h-14 rounded-2xl border-2 border-white/20 overflow-hidden bg-black/40 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-2xl">photo_library</span>
        </button>

        <button
          onClick={handleCapture}
          disabled={isScanning}
          className={`w-20 h-20 rounded-full border-[4px] border-white/60 p-1.5 transition-all ${
            isScanning ? "opacity-50 scale-90" : "active:scale-90"
          }`}
        >
          <div className="w-full h-full bg-primary rounded-full border-2 border-white/30 flex items-center justify-center" />
        </button>

        <div className="w-14 h-14 bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center text-white/40">
          <span className="material-symbols-outlined text-2xl opacity-50">shutter_speed</span>
        </div>
      </footer>
    </div>
  );
};

export default CameraScanner;
