import React, { useState, useEffect } from 'react';
import { generateCleanSlideBackground } from '../services/geminiService';
import { CleanedSlideData } from '../types';
// @ts-ignore
import PptxGenJS from 'pptxgenjs';

interface Step2Props {
  onComplete: (data: { slides: CleanedSlideData[], fileName: string }) => void;
  previousFile: string | null;
  pageCount: number;
  previewImage: string | null;
}

interface SlideState {
    id: number;
    status: 'pending' | 'processing' | 'success' | 'retry_needed' | 'error';
    img: string;
    errorMsg?: string;
    isReal: boolean;
}

const Step2Clean: React.FC<Step2Props> = ({ onComplete, previousFile, pageCount, previewImage }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [slides, setSlides] = useState<SlideState[]>([]);
  const [fileName, setFileName] = useState(previousFile || 'Project');
  const [isDownloadingPptx, setIsDownloadingPptx] = useState(false);
  
  const [requiresKeySelection, setRequiresKeySelection] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    const initialSlides: SlideState[] = Array.from({ length: pageCount }, (_, index) => {
        const id = index + 1;
        let imgSrc = `https://placehold.co/300x169/e2e8f0/64748b?text=Slide+${id}`;
        let isReal = false;
        if (id === 1 && previewImage) {
            imgSrc = previewImage;
            isReal = true;
        }
        return { id, status: 'pending', img: imgSrc, isReal };
    });
    setSlides(initialSlides);
    setIsCompleted(false);
    checkApiKeyStatus();
  }, [pageCount, previewImage]);

  useEffect(() => {
      if (previousFile) setFileName(previousFile);
  }, [previousFile]);

  const checkApiKeyStatus = async () => {
      if (window.aistudio) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setRequiresKeySelection(!hasKey);
      }
  };

  const handleSelectKey = async () => {
      if (window.aistudio) {
          try {
              await window.aistudio.openSelectKey();
              setRequiresKeySelection(false);
              setKeyError(null);
          } catch (e) {
              console.error("Key selection failed", e);
          }
      }
  };

  const processSlide = async (slide: SlideState): Promise<SlideState> => {
      if (!slide.isReal) return { ...slide, status: 'success' };
      try {
          const base64Data = slide.img.split(',')[1];
          const mimeType = slide.img.split(';')[0].split(':')[1];
          const cleanImageBase64 = await generateCleanSlideBackground(base64Data, mimeType);
          return { ...slide, status: 'success', img: `data:image/png;base64,${cleanImageBase64}` };
      } catch (error: any) {
          console.error(error);
          return { ...slide, status: 'error', errorMsg: '還原失敗' };
      }
  };

  const handleBatchClean = async () => {
      if (requiresKeySelection) { await handleSelectKey(); return; }
      setIsProcessing(true);
      const newSlides = [...slides];
      for (let i = 0; i < newSlides.length; i++) {
          if (newSlides[i].status !== 'success' && newSlides[i].isReal) {
             setSlides(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'processing' } : s));
             const result = await processSlide(newSlides[i]);
             newSlides[i] = result;
             setSlides([...newSlides]);
          }
      }
      setIsProcessing(false);
      if (newSlides.every(s => s.status === 'success')) setIsCompleted(true);
  };

  const handleDownloadBgOnlyPptx = async () => {
      setIsDownloadingPptx(true);
      try {
          const pres = new PptxGenJS();
          slides.forEach((slide) => {
              if (slide.status === 'success' && slide.isReal) {
                  const s = pres.addSlide();
                  s.addImage({ path: slide.img, x: 0, y: 0, w: '100%', h: '100%' });
              }
          });
          const outName = `${fileName}_Picture_layer.pptx`;
          await pres.writeFile({ fileName: outName });
      } finally {
          setIsDownloadingPptx(false);
      }
  };

  const handleNextStep = () => {
      const cleanedData: CleanedSlideData[] = slides.map(s => ({ id: s.id, imageUrl: s.img }));
      onComplete({ slides: cleanedData, fileName: fileName });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="mb-6 border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="bg-gray-800 text-white w-8 h-8 rounded flex items-center justify-center text-sm">2</span>
            工作區二：專業級底圖還原
        </h2>
        <p className="text-gray-500 mt-1">此模式專門針對 Banners (方案A/B) 與進度條結構進行 1:1 像素修復。</p>
      </div>

      {requiresKeySelection && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-5 animate-fade-in flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 text-amber-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <div className="flex-1">
                  <h4 className="font-bold text-amber-900 mb-1">需要連結付費 API Key</h4>
                  <p className="text-sm text-amber-800 mb-3">為了達到鑑識級效果，請選取已啟動計費的付費 API Key。</p>
                  <button onClick={handleSelectKey} className="px-6 py-2 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 transition-all shadow-md">連結 API Key</button>
              </div>
          </div>
      )}

      <div className="flex gap-4 mb-6">
          <div className="bg-gray-100 text-gray-400 rounded-lg px-6 py-3 font-bold flex-1 border border-gray-200 text-center">待處理：{slides.filter(s => s.isReal).length} 頁</div>
          <button onClick={handleBatchClean} disabled={isProcessing || isCompleted} className={`px-6 py-3 rounded-lg font-bold flex-1 transition-all shadow-md ${isProcessing ? 'bg-gray-300' : isCompleted ? 'bg-green-100 text-green-600' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
            {isProcessing ? 'AI 正在分析橫幅與圖表結構...' : isCompleted ? '底圖層還原完成' : '開始 AI 底圖還原'}
          </button>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {slides.map((slide) => (
                <div key={slide.id} className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 relative">
                    <img src={slide.img} className="w-full h-full object-contain rounded-lg aspect-video bg-gray-100" />
                    <div className="absolute top-2 right-2">
                        {slide.status === 'success' && <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg></div>}
                        {slide.status === 'processing' && <div className="w-6 h-6 border-2 border-t-blue-500 border-gray-300 rounded-full animate-spin"></div>}
                    </div>
                </div>
            ))}
         </div>
      </div>

      {isCompleted && (
          <div className="mt-8 bg-green-50 rounded-xl p-6 border border-green-200 animate-fade-in">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button onClick={handleDownloadBgOnlyPptx} disabled={isDownloadingPptx} className="px-6 py-4 bg-white border-2 border-green-500 text-green-700 rounded-xl font-bold hover:bg-green-50 transition-all flex items-center justify-center gap-3 group">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            {isDownloadingPptx ? <div className="w-5 h-5 border-3 border-t-green-600 border-green-200 rounded-full animate-spin"></div> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>}
                        </div>
                        <div className="text-left">
                            <div className="text-sm">下載 PPTX</div>
                            <div className="text-[10px] opacity-60 font-normal">圖片層 ({fileName}_Picture_layer.pptx)</div>
                        </div>
                    </button>
                    <button onClick={handleNextStep} className="px-6 py-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg flex items-center justify-center gap-3">
                        <span className="text-lg">進入最終合併</span>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                    </button>
               </div>
          </div>
      )}
    </div>
  );
};

export default Step2Clean;