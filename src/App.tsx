import React, { useState } from 'react';
import StepIndicator from './components/StepIndicator';
import Step1Upload from './components/Step1Upload';
import Step2Clean from './components/Step2Clean';
import Step3Merge from './components/Step3Merge';
import { AppStep, ExtractedData, CleanedSlideData } from './types';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.UPLOAD_SEPARATE);
  
  // Store data from Step 1
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  
  // Store data from Step 2
  const [cleanedSlides, setCleanedSlides] = useState<CleanedSlideData[]>([]);

  // Shared Filename (can be updated in Step 1 or Step 2)
  const [finalFileName, setFinalFileName] = useState<string>("Presentation");

  const handleStep1Complete = (data: { fileName: string; extractedText: any; pageCount: number; previewImage: string | null }) => {
    setExtractedData({ 
        fileName: data.fileName,
        extractedText: data.extractedText,
        pageCount: data.pageCount,
        previewImage: data.previewImage
    });
    setFinalFileName(data.fileName);
    // Automatically advance to next step after short delay for UX
    setTimeout(() => setCurrentStep(AppStep.AI_CLEAN), 1500);
  };

  const handleStep2Complete = (data: { slides: CleanedSlideData[], fileName: string }) => {
    setCleanedSlides(data.slides);
    setFinalFileName(data.fileName); // Update filename if user changed it in Step 2
    setTimeout(() => setCurrentStep(AppStep.MERGE), 500);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg shadow-sm flex items-center justify-center text-white font-bold">
                    E
                </div>
                <h1 className="text-xl font-bold tracking-tight text-gray-900">
                  Edward <span className="font-normal text-gray-500">的魔法轉換器</span>
                </h1>
              </div>
            </div>
            <div className="flex items-center">
                <button className="text-gray-500 hover:text-gray-700 text-sm font-medium">使用說明文件</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Header Hero */}
        <div className="text-center mb-12">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">
                讓您的 PDF <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500">復活並可編輯</span>
            </h2>
        </div>

        {/* Stepper */}
        <StepIndicator currentStep={currentStep} setStep={setCurrentStep} />

        {/* Dynamic Step Content */}
        <div className="max-w-5xl mx-auto transition-all duration-500">
          {currentStep === AppStep.UPLOAD_SEPARATE && (
            <Step1Upload onComplete={handleStep1Complete} />
          )}

          {currentStep === AppStep.AI_CLEAN && (
            <Step2Clean 
                onComplete={handleStep2Complete} 
                previousFile={finalFileName}
                pageCount={extractedData?.pageCount || 1}
                previewImage={extractedData?.previewImage || null}
            />
          )}

          {currentStep === AppStep.MERGE && (
            <Step3Merge 
                fileName={finalFileName}
                textData={extractedData?.extractedText}
                bgImages={cleanedSlides}
            />
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm mt-12">
        &copy; {new Date().getFullYear()} Edward 的魔法轉換器. 由 Google Gemini Vision 提供技術支援。
      </footer>
    </div>
  );
};

export default App;
