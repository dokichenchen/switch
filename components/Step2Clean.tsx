
import React, { useState, useEffect } from 'react';
import { generateCleanSlideBackground } from '../services/geminiService';
import { CleanedSlideData } from '../types';
// @ts-ignore
import PptxGenJS from 'pptxgenjs';

interface Step2Props {
  onComplete: (data: { slides: CleanedSlideData[], fileName: string }) => void;
  previousFile: string | null;
  pageCount: number;
  previewImages: string[];
}

interface SlideState {
    id: number;
    status: 'pending' | 'processing' | 'success' | 'retry_needed' | 'error';
    img: string;
    originalImg: string; // 保留原始圖以便重新嘗試
    errorMsg?: string;
    isReal: boolean;
}

const Step2Clean: React.FC<Step2Props> = ({ onComplete, previousFile, pageCount, previewImages }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [slides, setSlides] = useState<SlideState[]>([]);
  const [fileName, setFileName] = useState(previousFile || 'Project');
  const [isDownloadingPptx, setIsDownloadingPptx] = useState(false);
  
  const [requiresKeySelection, setRequiresKeySelection] = useState(false);

  useEffect(() => {
    const initialSlides: SlideState[] = Array.from({ length: pageCount }, (_, index) => {
        const id = index + 1;
        const imgData = previewImages[index];
        const isActuallyReal = !!imgData && imgData.startsWith('data:');
        
        return { 
            id, 
            status: 'pending', 
            img: imgData || '', 
            originalImg: imgData || '',
            isReal: isActuallyReal 
        };
    });
    setSlides(initialSlides);
    setIsCompleted(false);
    checkApiKeyStatus();
  }, [pageCount, previewImages]);

  const checkApiKeyStatus = async () => {
      if (window.aistudio) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setRequiresKeySelection(!hasKey);
      }
  };

  const processOneSlide = async (id: number) => {
      const slide = slides.find(s => s.id === id);
      if (!slide || !slide.isReal) return;

      setSlides(prev => prev.map(s => s.id === id ? { ...s, status: 'processing' } : s));

      try {
          const parts = slide.originalImg.split(',');
          const base64Data = parts[1];
          const mimeType = slide.originalImg.split(';')[0].split(':')[1];
          
          // 呼叫高品質還原服務
          const cleanImageBase64 = await generateCleanSlideBackground(base64Data, mimeType);
          
          setSlides(prev => prev.map(s => s.id === id ? { 
              ...s, 
              status: 'success', 
              img: `data:image/png;base64,${cleanImageBase64}` 
          } : s));
      } catch (error: any) {
          // Fix: Reset key selection if the requested entity was not found (usually means project/billing issues)
          if (error.message?.includes("Requested entity was not found.")) {
              setRequiresKeySelection(true);
              if (window.aistudio) await window.aistudio.openSelectKey();
          }
          setSlides(prev => prev.map(s => s.id === id ? { ...s, status: 'error', errorMsg: '還原失敗' } : s));
      }
  };

  const handleBatchClean = async () => {
      // Fix: Follow guidelines to assume selection success and proceed immediately to app logic
      if (requiresKeySelection) {
          if (window.aistudio) await window.aistudio.openSelectKey();
          setRequiresKeySelection(false);
      }

      setIsProcessing(true);
      const pendingSlides = slides.filter(s => s.status !== 'success' && s.isReal);
      
      // 關鍵優化：嚴格序列化，一頁處理完才處理下一頁，避免併發導致 AI 性能下降
      for (const slide of pendingSlides) {
          await processOneSlide(slide.id);
      }
      
      setIsProcessing(false);
      setSlides(prev => {
          if (prev.every(s => s.status === 'success' || !s.isReal)) setIsCompleted(true);
          return prev;
      });
  };

  const handleDownloadBgOnlyPptx = async () => {
      setIsDownloadingPptx(true);
      try {
          const pres = new PptxGenJS();
          slides.forEach((slide) => {
              if (slide.img.startsWith('data:')) {
                  const s = pres.addSlide();
                  s.addImage({ path: slide.img, x: 0, y: 0, w: '100%', h: '100%' });
              }
          });
          await pres.writeFile({ fileName: `${fileName}_Picture_layer.pptx` });
      } finally { setIsDownloadingPptx(false); }
  };

  const handleNextStep = () => {
      onComplete({ slides: slides.map(s => ({ id: s.id, imageUrl: s.img })), fileName: fileName });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="mb-6 border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-gray-800 text-white w-8 h-8 rounded flex items-center justify-center text-sm">2</span>
            工作區二：專業級底圖還原
        </h2>
        <p className="text-gray-500 mt-1">針對多頁 PDF 進行精準去文字。如果某頁效果不佳，您可以點擊「重新高品質還原」。</p>
      </div>

      <div className="flex flex-col gap-3 mb-8">
          <button onClick={handleBatchClean} disabled={isProcessing || isCompleted} className={`px-8 py-4 rounded-xl font-extrabold flex-1 transition-all shadow-xl active:scale-95 ${isProcessing ? 'bg-blue-100 text-blue-400' : isCompleted ? 'bg-green-100 text-green-600 border-2 border-green-200' : 'bg-gray-900 text-white hover:bg-black'}`}>
            {isProcessing ? 'AI 正在深度掃描每一頁像素...' : isCompleted ? '所有頁面還原完成' : '開始 AI 批次還原 (一頁一頁精準處理)'}
          </button>
          {/* Fix: Added mandatory link to billing docs for API key selection models */}
          {requiresKeySelection && (
              <div className="text-xs text-center text-gray-500 bg-yellow-50 p-2 rounded-lg border border-yellow-100">
                  當前模型需使用付費專案 API Key。請確認已設定 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold">付費項目 (Billing)</a>。
              </div>
          )}
      </div>

      <div className="bg-slate-50 rounded-2xl border-2 border-slate-100 p-6 max-h-[600px] overflow-y-auto custom-scrollbar">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
            {slides.map((slide) => (
                <div key={slide.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 group relative">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-black text-gray-300 uppercase tracking-widest">Page {slide.id}</span>
                        {slide.status === 'success' && (
                            <button onClick={() => processOneSlide(slide.id)} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity font-bold">重新高品質還原此頁</button>
                        )}
                    </div>
                    
                    <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-100 shadow-inner">
                        <img src={slide.img} className="w-full h-full object-contain" alt={`Slide ${slide.id}`} />
                        
                        {slide.status === 'processing' && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                                <div className="w-10 h-10 border-4 border-t-white border-white/20 rounded-full animate-spin mb-3"></div>
                                <span className="text-xs font-bold animate-pulse">正在精準重構底圖...</span>
                            </div>
                        )}
                        
                        {slide.status === 'success' && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </div>
                        )}
                    </div>

                    {slide.status === 'error' && <p className="text-[10px] text-red-500 mt-2 font-bold text-center">還原失敗，請檢查 API Key 或網路</p>}
                </div>
            ))}
         </div>
      </div>

      {isCompleted && (
          <div className="mt-10 bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-8 border-2 border-green-100 animate-fade-in text-center">
               <h3 className="text-gray-800 font-bold mb-6">已完成 {slides.length} 頁底圖高品質還原</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={handleDownloadBgOnlyPptx} disabled={isDownloadingPptx} className="bg-white border-2 border-blue-500 text-blue-700 py-4 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-md">
                        下載還原圖片層驗證
                    </button>
                    <button onClick={handleNextStep} className="bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-xl flex items-center justify-center gap-3">
                        <span className="text-lg">執行最終合併 (文字+底圖)</span>
                        <svg className="w-6 h-6 animate-pulse-x" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                    </button>
               </div>
          </div>
      )}
    </div>
  );
};

export default Step2Clean;
