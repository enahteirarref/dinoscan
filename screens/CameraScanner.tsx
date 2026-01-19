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

  // 用 ref 保证 cleanup 时能拿到最新 stream，避免旧闭包导致不 stop
  const streamRef = useRef<MediaStream | null>(null);

  // ---------- Camera setup ----------
  useEffect(() => {
    let mounted = true;

    async function setupCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!mounted) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        console.error("Error accessing camera:", err);
        alert("无法访问摄像头，请确保已授予权限，并使用 HTTPS 访问。");
      }
    }

    setupCamera();

    return () => {
      mounted = false;
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // ---------- Utils ----------
  function approxBase64Bytes(b64: string) {
    // base64 大小估算：len * 3/4（忽略 padding）
    return Math.floor((b64.length * 3) / 4);
  }

  function dataUrlToBase64(dataUrl: string) {
    return dataUrl.split(",")[1] || "";
  }

  function readFileAsDataURL(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.onloadend = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 把 canvas 内容导出为 jpeg base64（可控制最大边长/质量）
   */
  function canvasToJpegBase64(maxDim: number, quality: number, sourceW: number, sourceH: number, draw: () => void) {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const scale = Math.min(1, maxDim / Math.max(sourceW, sourceH));
    canvas.width = Math.round(sourceW * scale);
    canvas.height = Math.round(sourceH * scale);

    // 先清空再绘制，避免残影
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw();

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return { dataUrl, base64: dataUrlToBase64(dataUrl), width: canvas.width, height: canvas.height };
  }

  /**
   * 从 video 截图并自动压缩到目标大小（bytesLimit）
   * - 会逐步降低 maxDim 与 quality，直到 base64Bytes <= bytesLimit
   */
  function captureFromVideoAutoCompress(bytesLimit: number) {
    const video = videoRef.current!;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // 从更高质量开始，逐步兜底
    const attempts: Array<{ maxDim: number; quality: number }> = [
      { maxDim: 1280, quality: 0.75 },
      { maxDim: 1024, quality: 0.70 },
      { maxDim: 900, quality: 0.65 },
      { maxDim: 800, quality: 0.62 },
      { maxDim: 720, quality: 0.60 },
      { maxDim: 640, quality: 0.58 },
      { maxDim: 560, quality: 0.56 },
      { maxDim: 512, quality: 0.54 },
      { maxDim: 480, quality: 0.52 },
      { maxDim: 420, quality: 0.50 },
    ];

    let best: { dataUrl: string; base64: string; bytes: number } | null = null;

    for (const a of attempts) {
      const { dataUrl, base64 } = canvasToJpegBase64(a.maxDim, a.quality, vw, vh, () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      });
      const bytes = approxBase64Bytes(base64);
      best = { dataUrl, base64, bytes };
      if (bytes <= bytesLimit) break;
    }

    // best 一定有值
    return best!;
  }

  /**
   * 把上传图片（File）压缩到目标大小（bytesLimit）
   * - 解码成 Image 后绘制到 canvas，再导出 jpeg base64
   */
  async function compressFileToJpegBase64(file: File, bytesLimit: number) {
    const dataUrl = await readFileAsDataURL(file);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image decode failed"));
      image.src = dataUrl;
    });

    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;

    const attempts: Array<{ maxDim: number; quality: number }> = [
      { maxDim: 1600, quality: 0.78 },
      { maxDim: 1400, quality: 0.74 },
      { maxDim: 1200, quality: 0.70 },
      { maxDim: 1024, quality: 0.68 },
      { maxDim: 900, quality: 0.64 },
      { maxDim: 800, quality: 0.62 },
      { maxDim: 720, quality: 0.60 },
      { maxDim: 640, quality: 0.58 },
      { maxDim: 560, quality: 0.56 },
      { maxDim: 512, quality: 0.54 },
      { maxDim: 480, quality: 0.52 },
    ];

    let best: { dataUrl: string; base64: string; bytes: number } | null = null;

    for (const a of attempts) {
      const { dataUrl: outUrl, base64 } = canvasToJpegBase64(a.maxDim, a.quality, iw, ih, () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      });
      const bytes = approxBase64Bytes(base64);
      best = { dataUrl: outUrl, base64, bytes };
      if (bytes <= bytesLimit) break;
    }

    return best!;
  }

  async function safeReadErrorText(resp: Response) {
    const ct = resp.headers.get("content-type") || "";
    try {
      if (ct.includes("application/json")) {
        const j = await resp.json();
        return JSON.stringify(j);
      }
      return await resp.text();
    } catch {
      return "(failed to read upstream error body)";
    }
  }

  // ---------- Core ----------
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
        const text = await safeReadErrorText(resp);
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

    // 这里建议比后端 1.8MB 更低一些，避免 base64 膨胀导致 Vercel 平台层 413
    const BYTES_LIMIT = 1_200_000; // 约 1.2MB，更稳

    try {
      const { dataUrl, base64, bytes } = captureFromVideoAutoCompress(BYTES_LIMIT);
      console.log("[capture] compressed bytes:", bytes);

      // 如果仍然偏大，给用户更明确提示（理论上不会）
      if (bytes > BYTES_LIMIT) {
        alert(`图片仍然偏大（约 ${(bytes / 1024 / 1024).toFixed(2)}MB），请靠近拍摄或切换相册图片后再试。`);
        return;
      }

      await processImage(base64, dataUrl);
    } catch (e: any) {
      console.error(e);
      alert("拍摄失败：\n\n" + String(e?.message || e));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 允许同一张图重复选择触发 onChange
    e.target.value = "";

    const BYTES_LIMIT = 1_200_000;

    try {
      if (!canvasRef.current) throw new Error("canvas not ready");

      const { dataUrl, base64, bytes } = await compressFileToJpegBase64(file, BYTES_LIMIT);
      console.log("[upload] compressed bytes:", bytes);

      if (bytes > BYTES_LIMIT) {
        alert(`图片压缩后仍偏大（约 ${(bytes / 1024 / 1024).toFixed(2)}MB）。请换一张更小的图片或截图后再上传。`);
        return;
      }

      await processImage(base64, dataUrl);
    } catch (e2: any) {
      console.error(e2);
      alert("上传解析失败：\n\n" + String(e2?.message || e2));
    }
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
