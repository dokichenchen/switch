import { GoogleGenAI, Type } from "@google/genai";

/**
 * Helper to initialize Gemini Client. 
 */
const getClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Step 1: Layout Recovery Analysis
 */
export const analyzeSlideStructure = async (base64Image: string, mimeType: string = 'image/jpeg') => {
    if (!base64Image || base64Image.length < 100) {
        throw new Error("無效的影像數據：影像內容過短或格式錯誤。");
    }
    
    try {
        const ai = getClient();
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Image
                        }
                    },
                    {
                        text: `Analyze this 16:9 presentation slide as a professional DTP Expert.
                        Your task is to identify and extract EVERY SINGLE piece of text for conversion to editable PowerPoint.
                        
                        INCLUDE:
                        1. Main titles, subtitles, and headings.
                        2. All body text, bullet points, and paragraphs.
                        3. Text inside tables (every cell), charts, or organizational diagrams.
                        4. Captions, small labels, names, and identifiers next to icons/avatars.
                        5. Content inside information boxes, panels, speech bubbles, and banners.
                        
                        RETURN: A JSON object with an array of 'textBlocks'. Each block must have 'text' content, 'box_2d' [ymin, xmin, ymax, xmax] (0-1000 scale), 'fontSize', 'fontColor' (Hex), 'alignment', and 'isBold'.`
                    }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        textBlocks: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    text: { type: Type.STRING },
                                    box_2d: {
                                        type: Type.ARRAY,
                                        items: { type: Type.INTEGER }
                                    },
                                    fontSize: { type: Type.INTEGER },
                                    fontColor: { type: Type.STRING },
                                    fontFamilyType: {
                                        type: Type.STRING,
                                        enum: ["sans-serif", "serif", "monospace"]
                                    },
                                    alignment: {
                                        type: Type.STRING,
                                        enum: ["left", "center", "right"]
                                    },
                                    isBold: { type: Type.BOOLEAN }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!response.text) throw new Error("Empty AI response");
        return response.text;
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        throw error;
    }
};

/**
 * Step 2: High-Fidelity Background Reconstruction (ANTI-HALLUCINATION EDITION)
 */
export const generateCleanSlideBackground = async (base64Image: string, mimeType: string = 'image/jpeg') => {
    if (!base64Image || base64Image.length < 100) {
        throw new Error("無效的影像數據：無法處理。");
    }

    try {
        const ai = getClient();
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Image
                        }
                    },
                    {
                        text: `You are an expert AI specialized in transforming content-filled slides into BLANK TEMPLATES. 
                        
                        MANDATORY RULES TO PREVENT HALLUCINATIONS:
                        1. **BACKGROUND COLOR FIDELITY**: You MUST strictly preserve the ORIGINAL background color of the input image. If the background is white/light gray (like a table slide), keep it white. DO NOT change a white background to blue, even if other slides are blue. Each slide must be processed independently based on its own source colors.
                        2. **ZERO-TOLERANCE for TEXT**: Erase ALL characters (Chinese/Kanji, English, Numbers). This includes text in titles, footers, charts, and diagrams.
                        3. **TABLE RECONSTRUCTION**: Keep all grid lines and cell borders. BUT, erase all content inside every cell. The cells must be completely blank (matching the cell's background color).
                        4. **INFO-BOXES & PANELS**: Remove text from all panels and boxes. Keep the shapes and borders. 
                        5. **DIAGRAM LABELS**: Remove all labels like "1.", "2.", "3." and descriptions near icons.
                        
                        PRESERVATION: Keep graphic icons, human avatars, arrows, and complex illustrations.
                        
                        QUALITY: Smooth in-painting only. No blurry traces, no ghosting, and NO color leakage from other themes.`
                    }
                ]
            },
            config: {
                imageConfig: {
                    aspectRatio: "16:9",
                    imageSize: "1K"
                }
            }
        });

        if (response.candidates && response.candidates[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) return part.inlineData.data;
            }
        }
        
        throw new Error("AI 拒絕生成影像或內容受限。");
    } catch (error) {
        console.error("Gemini Cleaning Error:", error);
        throw error;
    }
};
