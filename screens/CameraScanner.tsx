import React, { useState, useRef, useEffect, useMemo } from "react";
import { Fossil } from "../types";
import { GoogleGenAI } from "@google/genai";

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

  // Read API key from Vite env
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  // Create AI client once (memoized)
  const ai = useMemo(() => {
    if (!apiKey) {
      console.warn("VITE_GEMINI_API_KEY is empty");
    }
    return new GoogleGenAI({ apiKey: apiKey ?? "" });
  }, [apiKey]);

  // Initialize camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1080 },
            height: { ideal: 1920 },
          },
          audio: false,
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        alert("无法访问摄像头，请确保已授予权限。");
      }
    }

    setupCamera();

    return () => {
      // stop camera tracks
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processImage = async (base64Data: string, imageUrl: string) => {
    if (!apiKey) {
      alert(
        "VITE_GEMINI_API_KEY 为空。\n\n请在项目根目录 .env.local 写入：\nVITE_GEMINI_API_KEY=你的真实key\n\n然后重启 npm run dev"
      );
      return;
    }

    setIsScanning(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  '你是一位资深的古生物学家。请识别这张照片中的恐龙化石或骨骼。即使照片略有模糊或光线不足，也请基于可见特征给出最可能的专业推测。请提供：1.中文名称 2.地质年代 3.分类 4.预估长度 5.稀有度（普通、稀有、或传说） 6.置信度(0-100) 7.一段2句简短的专业笔记。请务必使用简体中文回答。以 JSON 格式返回: { "Name": "名称", "Era": "年代", "Classification": "分类", "Length": "长度", "Rarity": "稀有度", "Confidence": 95, "Note": "笔记内容" }',
              },
              { inlineData: { mimeType: "image/jpeg", data: base64Data } },
            ],
          },
        ],
        config: { responseMimeType: "application/json" },
      });

      // Robust JSON parsing
      const raw = response.text || "";
      let data: any = {};
      try {
        data = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        if (m) data = JSON.parse(m[0]);
        else
          throw new Error(
            "模型未返回 JSON。原始返回前200字：\n" + raw.slice(0, 200)
          );
      }

      // Get precise location at capture time
      let lat = 39.9042,
        lng = 116.4074;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            timeout: 5000,
            enableHighAccuracy: true,
          })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.warn("GPS lookup failed, using fallback", e);
      }

      const fossilResult: Fossil = {
        id: Math.random().toString(36).substr(2, 9),
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
    } catch (error: any) {
      console.error("AI Analysis failed", error);

      const msg =
        error?.message ||
        (typeof error === "string" ? error : JSON.stringify(error, null, 2));

      alert(
        "分析失败（真实原因如下）:\n\n" +
          msg +
          "\n\n常见修复：\n" +
          "1) API Key 为空/无效\n" +
          "2) API Key 做了 HTTP Referrer 限制，未包含当前地址\n" +
          "3) 图片太大导致请求失败\n" +
          "4) 模型返回不是 JSON，JSON.parse 失败"
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Optional: downscale to reduce failures on mobile
    const maxDim = 1280;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));

    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    const base64 = dataUrl.split(",")[1];
    processImage(base64, dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      processImage(base64, result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="h-screen w-full relative bg-black flex flex-col overflow-hidden">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Real Camera Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      <header className="relative z-10 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent pt-12">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-black/40 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center text-white active:scale-90 transition-transform"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="flex gap-4">
          <div className="bg-primary/20 backdrop-blur-md px-3 py-1 rounded-full border border-primary/30 flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
            <span className="text-[10px] text-white font-black uppercase tracking-widest">
              Live Link
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 relative flex flex-col items-center justify-center">
        {/* Viewfinder Overlay */}
        <div className="relative w-72 h-72 pointer-events-none">
          <div
            className={`absolute inset-0 scan-grid opacity-20 ${
              isScanning ? "animate-pulse scale-110" : ""
            }`}
          ></div>

          <div className="absolute top-0 left-0 w-12 h-12 border-t-[3px] border-l-[3px] border-white rounded-tl-xl shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
          <div className="absolute top-0 right-0 w-12 h-12 border-t-[3px] border-r-[3px] border-white rounded-tr-xl shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
          <div className="absolute bottom-0 left-0 w-12 h-12 border-b-[3px] border-l-[3px] border-white rounded-bl-xl shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b-[3px] border-r-[3px] border-white rounded-br-xl shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>

          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-lg rounded-xl z-20">
              <div className="text-white font-bold flex flex-col items-center gap-4 text-center px-4">
                <div className="relative">
                  <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-primary text-2xl">
                    insights
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm tracking-widest uppercase text-primary">
                    正在分析图像
                  </p>
                  <p className="text-[10px] text-white/60 font-medium">
                    提取矿物纹理中...
                  </p>
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
          <span className="material-symbols-outlined text-2xl">
            photo_library
          </span>
        </button>

        <button
          onClick={handleCapture}
          disabled={isScanning}
          className={`w-20 h-20 rounded-full border-[4px] border-white/60 p-1.5 transition-all ${
            isScanning ? "opacity-50 scale-90" : "active:scale-90"
          }`}
        >
          <div className="w-full h-full bg-primary rounded-full border-2 border-white/30 shadow-[0_0_20px_rgba(128,176,109,0.5)] flex items-center justify-center">
            <div className="w-full h-full rounded-full border border-white/20 flex items-center justify-center">
              <div className="w-4 h-4 bg-white/40 rounded-full"></div>
            </div>
          </div>
        </button>

        <div className="w-14 h-14 bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 flex items-center justify-center text-white/40">
          <span className="material-symbols-outlined text-2xl opacity-50">
            shutter_speed
          </span>
        </div>
      </footer>
    </div>
  );
};

export default CameraScanner;
