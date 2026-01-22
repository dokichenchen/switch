import React, { useState, useRef, useEffect } from 'react';
import { analyzeSlideStructure } from '../services/geminiService';
import { ProcessingStatus } from '../types';
// @ts-ignore
import PptxGenJS from 'pptxgenjs';

interface Step1Props {
  onComplete: (data: { fileName: string; extractedText: any; pageCount: number; previewImage: string | null }) => void;
}

const Step1Upload: React.FC<Step1Props> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, message: '', progress: 0 });
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [detectedPageCount, setDetectedPageCount] = useState<number>(1);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // When file is selected, set default filename without extension
  useEffect(() => {
    if (file) {
        const name = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setFileName(name);
    }
  }, [file]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      if (selectedFile.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => setPreview(ev.target?.result as string);
          reader.readAsDataURL(selectedFile);
      } else {
          setPreview("https://placehold.co/600x400/e2e8f0/64748b?text=PDF+Document+Preview");
      }
      setAnalysisResult(null);
      setDetectedPageCount(1);
    }
  };

  /**
   * Helper function to select the best font based on content and style.
   * Handles Chinese font mapping explicitly.
   */
  const getBestFont = (text: string, fontFamilyType: string) => {
      // Regular expression to check for Chinese characters
      const hasChinese = /[\u4e00-\u9fa5]/.test(text);

      if (hasChinese) {
          if (fontFamilyType === 'serif') {
              // Songti / Ming style
              return "PMingLiU"; // 新細明體
          } else {
              // Heiti / Gothic style (Default for most modern slides)
              return "Microsoft JhengHei"; // 微軟正黑體
          }
      }

      // Fallback for purely English/Number text
      if (fontFamilyType === 'serif') return "Times New Roman";
      if (fontFamilyType === 'monospace') return "Courier New";
      if (fontFamilyType === 'handwriting') return "Segoe Print";
      
      return "Arial"; // Default safe sans-serif
  };

  const generateTextPptx = async (data: any, manualDownload = false) => {
      try {
        const pres = new PptxGenJS();
        let slide = pres.addSlide();
        
        // --- 核心修改：像素級還原邏輯 (Pixel-Perfect) ---
        if (data && data.textBlocks && Array.isArray(data.textBlocks) && data.textBlocks.length > 0) {
            
            data.textBlocks.forEach((block: any) => {
                const text = block.text;
                // Gemini Vision 座標為 0-1000 的整數
                // box_2d = [ymin, xmin, ymax, xmax]
                const box = block.box_2d || [0, 0, 1000, 1000];
                const ymin = box[0];
                const xmin = box[1];
                const ymax = box[2];
                const xmax = box[3];

                // 計算位置與大小百分比
                const x = (xmin / 1000) * 100;
                const y = (ymin / 1000) * 100;
                const w = ((xmax - xmin) / 1000) * 100;
                const h = ((ymax - ymin) / 1000) * 100; 

                // --- 樣式還原 ---
                
                // 1. 字體大小
                let fontSize = block.fontSize;
                if (!fontSize || fontSize < 6) {
                    fontSize = 12; // Standard Default
                }

                // 2. 字體顏色 (移除 #)
                let color = block.fontColor || '#000000';
                if (color.startsWith('#')) {
                    color = color.substring(1);
                }

                // 3. 對齊 (Alignment)
                let align = block.alignment || 'left';
                if (align === 'justify') align = 'left'; 

                // 4. 智能字體選擇 (Intelligent Font Mapping)
                const fontFace = getBestFont(text, block.fontFamilyType);

                // 5. 粗體/斜體
                const isBold = !!block.isBold;
                const isItalic = !!block.isItalic;

                slide.addText(text, {
                    x: `${x}%`,
                    y: `${y}%`,
                    w: `${w}%`,
                    h: `${h}%`,
                    fontSize: fontSize,
                    color: color,
                    align: align, 
                    bold: isBold,
                    italic: isItalic,
                    fontFace: fontFace,
                    valign: 'top', // 文字貼頂，符合 tight box 邏輯
                    wrap: true, // 允許換行
                    margin: 0, // 關鍵：移除內距，讓文字緊貼 AI 偵測的邊框
                    autoFit: false // 關鍵：禁止自動縮放字體，完全信任 AI 的 pt 判斷
                });
            });

        } else if (data && data.content) {
            // Fallback: 舊格式兼容
            const titleText = (data && data.title) ? data.title : "未偵測到標題";
            slide.addText(titleText, { x: 0.5, y: 0.5, w: '90%', h: 1, fontSize: 24, color:'363636', bold: true });
        } else {
            slide.addText("此頁面無文字內容，或無法辨識。", { x: 1, y: 2.5, fontSize: 14 });
        }
        
        // Footer note
        slide.addText("(此文字層已使用 Gemini Pixel-Perfect Forensic 模式還原)", { x: 0.5, y: '95%', fontSize: 8, color: 'CCCCCC' });

        const fName = `${fileName}_Text_layer.pptx`; 
        await pres.writeFile({ fileName: fName });
        return true;
      } catch (e) {
        console.error("DL Error", e);
        alert("下載失敗");
        return false;
      }
  };

  // Helper to convert file to base64 for API
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data url prefix (e.g. "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = (error) => reject(error);
    });
  };

  const startAnalysis = async () => {
    if (!file) return;

    setStatus({ isProcessing: true, message: '正在準備檔案...', progress: 5 });

    try {
        let extractedData = null;
        let pageCount = 1;

        if (file.type.startsWith('image/')) {
             // Real processing for Images
             pageCount = 1;
             setStatus({ isProcessing: true, message: 'Gemini 鑑識模型正在測量像素座標與字體...', progress: 30 });
             const base64 = await fileToBase64(file);
             
             // Call API
             const jsonString = await analyzeSlideStructure(base64, file.type);
             console.log("Gemini Response:", jsonString); // Debug log

             try {
                 extractedData = JSON.parse(jsonString || '{}');
             } catch (parseError) {
                 console.error("Failed to parse Gemini JSON:", parseError);
                 extractedData = { title: fileName, content: ["解析失敗，請重試"] };
             }

        } else {
            // Fallback for PDFs
            pageCount = 5; 
            setStatus({ isProcessing: true, message: '偵測到 PDF 格式...', progress: 40 });
            await new Promise(resolve => setTimeout(resolve, 1500)); 
            extractedData = {
                title: fileName + " (PDF 模式)",
                content: [
                    "系統偵測到您上傳了 PDF 文件。",
                    "為了達到 Pixel-Perfect 效果，請將 PDF 轉存為高解析度 PNG 圖片後上傳。"
                ]
            };
        }

        setStatus({ isProcessing: true, message: '分析完成！請選擇下載或繼續', progress: 100 });
        
        // Save results but DO NOT auto download
        setAnalysisResult(extractedData);
        setDetectedPageCount(pageCount);
        setStatus({ isProcessing: false, message: '提取完成！', progress: 100 });

    } catch (error: any) {
        console.error("Processing Error:", error);
        setStatus({ isProcessing: false, message: '錯誤：' + (error.message || "處理失敗"), progress: 0, error: error.message });
    }
  };

  const handleManualDownload = async () => {
      if (analysisResult) {
          await generateTextPptx(analysisResult);
      }
  };

  const handleNextStep = () => {
      if (analysisResult) {
          onComplete({ 
            fileName: fileName, 
            extractedText: analysisResult,
            pageCount: detectedPageCount,
            previewImage: preview
          });
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 relative overflow-hidden">
      <div className="mb-6 border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="bg-gray-800 text-white w-8 h-8 rounded flex items-center justify-center text-sm">1</span>
          工作區一：視覺還原
        </h2>
        <p className="text-gray-500 mt-1">上傳 PDF 或圖片，調整檔名，並提取「活的文字」。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Upload Area */}
        <div className="space-y-4">
            <div 
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center min-h-[250px] transition-colors ${file ? 'border-green-400 bg-green-50/30' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
                }}
            >
                <input 
                    type="file" 
                    accept=".pdf,image/png,image/jpeg,image/*" 
                    onChange={handleFileChange} 
                    className="hidden" 
                    ref={fileInputRef}
                />
                
                {preview ? (
                    <div className="relative w-full h-full flex flex-col items-center">
                        <img src={preview} alt="Preview" className="max-h-48 shadow-sm rounded border bg-white" />
                        <button 
                            onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setAnalysisResult(null); }}
                            className="mt-2 text-xs text-red-500 hover:underline"
                        >
                            移除檔案
                        </button>
                    </div>
                ) : (
                    <div className="text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-700">點擊上傳 PDF/PNG</h3>
                        <p className="text-xs text-gray-400 mt-1">Google LLM 生成的檔案</p>
                    </div>
                )}
            </div>

            {/* Filename Input (Keep on left for initial setup) */}
            {file && !analysisResult && (
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">專案 / 檔案名稱</label>
                    <input 
                        type="text" 
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>
            )}
        </div>

        {/* Right: Action Area */}
        <div className="flex flex-col justify-center space-y-6">
             {!analysisResult ? (
                 <>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">1</div>
                            <p className="text-sm text-gray-600">拖放 NotebookLM PDF 檔案（推薦使用 PNG 圖片以獲得最佳效果）。</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">2</div>
                            <p className="text-sm text-gray-600">如有需要請重新命名檔案。</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">3</div>
                            <p className="text-sm text-gray-600">點擊按鈕提取文字層 (Text_layer)。</p>
                        </div>
                    </div>

                    {status.isProcessing ? (
                         <div className="space-y-2">
                             <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                 <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${status.progress}%` }}></div>
                             </div>
                             <p className="text-sm font-medium text-green-600 animate-pulse text-center">{status.message}</p>
                         </div>
                     ) : (
                        <button 
                            disabled={!file}
                            onClick={startAnalysis}
                            className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 ${file ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}`}
                        >
                            視覺還原 PPTX
                        </button>
                     )}
                 </>
             ) : (
                 <div className="bg-green-50 rounded-xl p-6 border border-green-200 animate-fade-in relative">
                     <h3 className="text-green-800 font-bold text-lg mb-4 flex items-center gap-2">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                         視覺還原完成
                     </h3>
                     
                     {/* Filename Input for confirmation (Like Step 2) */}
                     <div className="mb-4 bg-white p-4 rounded-lg border border-green-100 shadow-sm">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">專案 / 檔案名稱</label>
                        <input 
                            type="text" 
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            className="w-full bg-transparent border-b border-gray-300 py-1 text-lg font-bold text-gray-800 focus:border-green-500 focus:outline-none transition-colors"
                            placeholder="輸入檔案名稱"
                        />
                     </div>

                     <div className="flex flex-col gap-3">
                         <button 
                             onClick={handleManualDownload}
                             className="w-full px-6 py-4 bg-white border-2 border-green-500 text-green-700 rounded-xl font-bold hover:bg-green-50 transition-all shadow-sm flex items-center justify-center gap-2 group"
                         >
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            </div>
                            <div className="text-left">
                                <div className="text-sm leading-tight">下載 PPTX</div>
                                <div className="text-xs opacity-60">文字層 ({fileName}_Text_layer.pptx)</div>
                            </div>
                         </button>

                         <button 
                             onClick={handleNextStep}
                             className="w-full px-6 py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg hover:shadow-green-200 hover:-translate-y-1 flex items-center justify-center gap-3"
                         >
                            <span>前往第二步：去背</span>
                            <svg className="w-5 h-5 animate-pulse-x" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                         </button>
                     </div>
                 </div>
             )}
        </div>
      </div>
    </div>
  );
};

export default Step1Upload;