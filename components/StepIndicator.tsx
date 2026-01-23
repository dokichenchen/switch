import React from 'react';
import { AppStep } from '../types';

interface StepIndicatorProps {
  currentStep: AppStep;
  setStep: (step: AppStep) => void;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, setStep }) => {
  const steps = [
    { id: AppStep.UPLOAD_SEPARATE, title: "1. 文字辨識工作區", desc: "提取文字與版面" },
    { id: AppStep.AI_CLEAN, title: "2. 圖片去文字工作區", desc: "去除文字，還原圖片" },
    { id: AppStep.MERGE, title: "3. 魔法合併工作區", desc: "合併並編輯" },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto mb-8">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 -z-10 rounded-full"></div>
        <div 
            className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-green-500 -z-10 transition-all duration-500 rounded-full"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step) => {
          const isActive = currentStep >= step.id;
          const isCurrent = currentStep === step.id;
          
          return (
            <div 
                key={step.id} 
                className={`flex flex-col items-center cursor-pointer group`}
                onClick={() => setStep(step.id)}
            >
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 ${
                  isActive 
                    ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-200' 
                    : 'bg-white border-gray-300 text-gray-400 group-hover:border-gray-400'
                }`}
              >
                {isActive ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                ) : (
                    <span className="font-semibold">{step.id}</span>
                )}
              </div>
              <div className="mt-2 text-center hidden sm:block bg-white/80 px-2 rounded-md backdrop-blur-sm">
                <div className={`text-sm font-bold ${isCurrent ? 'text-gray-800' : 'text-gray-500'}`}>{step.title}</div>
                <div className="text-xs text-gray-400">{step.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;