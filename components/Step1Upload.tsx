
import React, { useState, useRef, useEffect } from 'react';
import { analyzeSlideStructure } from '../services/geminiService';
import { ProcessingStatus } from '../types';
// @ts-ignore
import PptxGenJS from 'pptxgenjs';

interface Step1Props {
  onComplete: (data: { fileName: string; extractedText: any[]; pageCount: number; previewImages: string[] }) => void;
}

const Step1Upload: React.FC<Step1Props> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>({ isProcessing: false, message: '', progress: 0 });
  const [analysisResults, setAnalysisResults] = useState<any[]>([]);
  const [detectedPageCount, setDetectedPageCount] = useState<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file) {
        const name = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setFileName(name);
    }
  }, [file]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setAnalysisResults([]);
      
      if (selectedFile.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const res = ev.target?.result as string;
              setPreviews([res]);
              setDetectedPageCount(1);
          };
          reader.readAsDataURL(selectedFile);
      } else if (selectedFile.type === 'application/pdf') {
          setStatus({ isProcessing: true, message: '正在以超高解析度解析 PDF...', progress: 10 });
          try {
              const arrayBuffer = await selectedFile.arrayBuffer();
              // @ts-ignore
              const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
              const pageCount = pdf.numPages;
              setDetectedPageCount(pageCount);
              
              const pagePreviews: string[] = [];
              for (let i = 1; i <= pageCount; i++) {
                  const page = await pdf.getPage(i);
                  const viewport = page.getViewport({ scale: 3.5 });
                  const canvas = document.createElement('canvas');
                  const context = canvas.getContext('2d');
                  canvas.height = viewport.height;
                  canvas.width = viewport.width;
                  
                  await page.render({ 
                      canvasContext: context!, 
                      viewport,
                      intent: 'print' 
                  }).promise;

                  pagePreviews.push(canvas.toDataURL('image/png'));
                  setStatus(prev => ({ ...prev, progress: 10 + (i / pageCount) * 20 }));
              }
              setPreviews(pagePreviews);
              setStatus({ isProcessing: false, message: 'PDF 影像提取完成', progress: 0 });
          } catch (err) {
              console.error("PDF Load Error", err);
              setStatus({ isProcessing: false, message: '解析失敗', progress: 0, error: '無法讀取 PDF' });
          }
      }
    }
  };

  const startAnalysis = async () => {
    if (previews.length === 0) return;

    setStatus({ isProcessing: true, message: 'AI 視覺辨識啟動中...', progress: 0 });
    const results: any[] = [];

    try {
        for (let i = 0; i < previews.length; i++) {
            setStatus({ 
                isProcessing: true, 
                message: `正在辨識第 ${i + 1} 頁文字與佈局...`, 
                progress: Math.round((i / previews.length) * 100) 
            });
            
            const base64 = previews[i].split(',')[1];
            const jsonString = await analyzeSlideStructure(base64, 'image/png');
            results.push(JSON.parse(jsonString || '{}'));
        }

        setAnalysisResults(results);
        setStatus({ isProcessing: false, message: '文字辨識完成！', progress: 100 });
    } catch (error: any) {
        setStatus({ isProcessing: false, message: '錯誤：' + error.message, progress: 0, error: error.message });
    }
  };

  const generateTextPptx = async () => {
      try {
        const pres = new PptxGenJS();
        pres.layout = 'LAYOUT_16x9';
        analysisResults.forEach((data, pageIdx) => {
            let slide = pres.addSlide();
            if (data && data.textBlocks) {
                data.textBlocks.forEach((block: any) => {
                    const box = block.box_2d || [0, 0, 1000, 1000];
                    slide.addText(block.text, {
                        x: `${(box[1] / 10).toFixed(2)}%`, 
                        y: `${(box[0] / 10).toFixed(2)}%`, 
                        w: `${((box[3] - box[1]) / 10).toFixed(2)}%`, 
                        h: `${((box[2] - box[0]) / 10).toFixed(2)}%`,
                        fontSize: block.fontSize || 12,
                        color: (block.fontColor || '000000').replace('#', ''),
                        align: block.alignment || 'left', 
                        bold: !!block.isBold,
                        fontFace: /[\u4e00-\u9fa5]/.test(block.text) ? "Microsoft YaHei" : "Arial",
                        valign: 'top', margin: 0
                    });
                });
            }
        });
        await pres.writeFile({ fileName: `${fileName}_Text_layer.pptx` });
      } catch (e) { alert("生成失敗"); }
  };

  const handleNextStep = () => {
    onComplete({
      fileName,
      extractedText: analysisResults,
      pageCount: detectedPageCount,
      previewImages: previews
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="mb-6 border-b border-gray-100 pb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="bg-gray-800 text-white w-8 h-8 rounded flex items-center justify-center text-sm">1</span>
          工作區一：高精細視覺辨識
        </h2>
        <p className="text-gray-500 mt-1">我們已將多頁 PDF 渲染精度提升至 350%，確保與單張 PNG 擁有同等辨識力。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
            <div 
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center min-h-[300px] transition-all ${file ? 'border-green-400 bg-green-50/30' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files?.[0]) handleFileChange({ target: { files: e.dataTransfer.files } } as any);
                }}
            >
                <input type="file" accept=".pdf,image/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
                {previews.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 w-full max-h-[350px] overflow-y-auto p-2">
                        {previews.map((p, idx) => (
                            <div key={idx} className="relative group">
                                <img src={p} className="w-full rounded-lg border-2 border-white shadow-sm transition-transform group-hover:scale-[1.02]" alt={`Page ${idx+1}`} />
                                <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 rounded">P{idx+1}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center cursor-pointer p-10" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-700">上傳檔案</h3>
                        <p className="text-sm text-gray-400 mt-2">支持高清 PDF 轉換為可編輯圖表</p>
                    </div>
                )}
            </div>
            {file && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="block text-xs font-bold text-gray-400 uppercase mb-2">專案存檔名稱</label>
                    <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
            )}
        </div>

        <div className="flex flex-col justify-center">
             {analysisResults.length === 0 ? (
                 <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100 text-center">
                    <div className="mb-6">
                        <span className="text-5xl mb-4 block">📄</span>
                        <p className="text-gray-600 font-medium">已準備好 <b>{detectedPageCount}</b> 頁內容</p>
                        <p className="text-xs text-gray-400 mt-1">每一頁都將以單張高品質模式進行 AI 掃描</p>
                    </div>
                    {status.isProcessing ? (
                         <div className="space-y-4">
                             <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                 <div className="h-full bg-blue-600 transition-all duration-500 ease-out" style={{ width: `${status.progress}%` }}></div>
                             </div>
                             <p className="text-sm font-bold text-blue-600 animate-pulse">{status.message}</p>
                         </div>
                     ) : (
                        <button disabled={!file} onClick={startAnalysis} className={`w-full py-4 rounded-xl font-bold text-white shadow-xl transition-all transform active:scale-95 ${file ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}>
                            執行高品質 AI 視覺分析
                        </button>
                     )}
                 </div>
             ) : (
                 <div className="bg-green-50 rounded-2xl p-8 border border-green-200 shadow-inner animate-fade-in text-center">
                     <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                         <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                     </div>
                     <h3 className="text-green-800 font-extrabold text-xl mb-2">全頁文字辨識完成</h3>
                     <p className="text-green-600/70 text-sm mb-6">文字層座標已精準鎖定，隨時可以合併。</p>
                     
                     <div className="grid grid-cols-1 gap-4">
                         <button onClick={generateTextPptx} className="bg-white border-2 border-green-500 text-green-700 py-3 rounded-xl font-bold hover:bg-green-100 transition-all flex items-center justify-center gap-2">
                             下載文字層驗收
                         </button>
                         <button onClick={handleNextStep} className="bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 shadow-lg flex items-center justify-center gap-3 group">
                            <span>下一步：批次底圖還原</span>
                            <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
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
