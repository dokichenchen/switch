export enum AppStep {
  UPLOAD_SEPARATE = 1,
  AI_CLEAN = 2,
  MERGE = 3
}

export interface ProcessingStatus {
  isProcessing: boolean;
  message: string;
  progress: number; // 0 to 100
  error?: string;
}

export interface ExtractedData {
  fileName: string;
  pageCount: number;
  extractedText: any; // The raw JSON from Gemini Step 1
  previewImage: string | null;
}

export interface CleanedSlideData {
  id: number;
  imageUrl: string; // Base64 or Blob URL
}
