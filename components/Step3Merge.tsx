
import React, { useState } from 'react';
import { CleanedSlideData } from '../types';
// @ts-ignore
import PptxGenJS from 'pptxgenjs';

interface Step3Props {
    fileName: string;
    textData: any[]; 
    bgImages: CleanedSlideData[]; 
}

const Step3Merge: React.FC<Step3Props> = ({ fileName, textData, bgImages }) => {
  const [isMerged, setIsMerged] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const handleMerge = () => {
    setIsMerging(true);
    setTimeout(() => {
        setIsMerged(true);
        setIsMerging(false);
    }, 1200);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
        const pres = new PptxGenJS();
        pres.layout = 'LAYOUT_16x9';

        bgImages.forEach((bgSlide, index) => {
             let slide = pres.addSlide();
             if (bgSlide.imageUrl) {
                 slide.addImage({ path: bgSlide.imageUrl, x: 0, y: 0, w: '100%', h: '100%' });
             }

             const pageTextData = Array.isArray(textData) ? textData[index] : (index === 0 ? textData : null); 
             
             if (pageTextData && pageTextData.textBlocks) {
                 pageTextData.textBlocks.forEach((block: any) => {
                    const box = block.box_2d || [0, 0, 1000, 1000];
                    const x = (box[1] / 1000) * 100;
                    const y = (box[0] / 1000) * 100;
                    const w = ((box[3] - box[1]) / 1000) * 100;
                    const h = ((box[2] - box[0]) / 1000) * 100; 

                    slide.addText(block.text, {
                        x: `${x}%`, y: `${y}%`, w: `${w}%`, h: `${h}%`,
                        fontSize: block.fontSize || 12,
                        color: (block.fontColor || '000000').replace('#', ''),
                        align: block.alignment || 'left', 
                        bold: !!block.isBold,
                        italic: !!block.isItalic,
                        fontFace: /[\u4e00-\u9fa5]/.test(block.text) ? "Microsoft YaHei" : "Arial",
                        valign: 'top', margin: 0, autoFit: false
                    });
                 });
             }
        });

        await pres.writeFile({ fileName: `${fileName}_Final.pptx` });
    } finally {
        setIsDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="bg-gray-800 text-white w-8 h-8 rounded flex items-center justify-center text-sm">3</span>
          魔法合併工作區 (Pixel-Perfect)
        </h2>
        <p className="text-gray-500 mt-1">最終階段：自動對齊多頁文字座標與還原底圖，完成最終可編輯檔案。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
            <h3 className="font-bold text-gray-800 text-sm mb-1">文字層數據</h3>
            <div className="text-[10px] text-green-600 font-bold bg-green-100 px-2 py-1 rounded inline-block">{bgImages.length} 頁已就緒</div>
        </div>

        <div className="flex flex-col items-center">
             {!isMerged ? (
                 <button onClick={handleMerge} className="w-full bg-gray-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    執行多頁魔法合併
                 </button>
             ) : (
                 <button onClick={handleDownload} disabled={isDownloading} className="w-full bg-green-600 text-white px-6 py-4 rounded-xl font-bold shadow-xl hover:bg-green-700 transition-all flex flex-col items-center">
                    <div className="flex items-center gap-2">
                        {isDownloading ? <div className="w-4 h-4 border-2 border-t-white border-green-300 rounded-full animate-spin"></div> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>}
                        <span>下載最終多頁檔案</span>
                    </div>
                    <span className="text-[10px] font-normal opacity-70 mt-1">{fileName}_Final.pptx</span>
                 </button>
             )}
        </div>

        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
            <h3 className="font-bold text-gray-800 text-sm mb-1">還原底圖層</h3>
            <div className="text-[10px] text-green-600 font-bold bg-green-100 px-2 py-1 rounded inline-block">{bgImages.length} 頁已還原</div>
        </div>
      </div>
    </div>
  );
};

export default Step3Merge;
