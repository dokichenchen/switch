import { GoogleGenAI, Type } from "@google/genai";

/**
 * Helper to initialize Gemini Client. 
 * Must create a new instance right before use to ensure the latest API key is used.
 */
const getClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

/**
 * Step 1: Layout Recovery Analysis
 * Extracts text with high precision coordinates.
 */
export const analyzeSlideStructure = async (base64Image: string, mimeType: string = 'image/jpeg') => {
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
                        text: `You are a professional DTP Expert. Analyze this 16:9 slide.
                        Extract ALL text including:
                        1. Main titles and headers.
                        2. Section labels like "方案 A" and "方案 B".
                        3. Numbers and labels inside charts/tables.
                        Return exact [ymin, xmin, ymax, xmax] in 0-1000 scale, font details, and colors.`
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
 * Step 2: High-Fidelity Background Reconstruction
 * Specifically targets headers and data bars for clean removal while keeping structures.
 */
export const generateCleanSlideBackground = async (base64Image: string, mimeType: string = 'image/jpeg') => {
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
                        text: `You are a World-Class Graphic Reconstruction AI. Your goal is to create a 100% PERFECT text-free PPT template.

STRICT INSTRUCTIONS FOR THE ATTACHED INFOGRAPHIC:
1. TOP BANNERS & HEADERS: Identify colored bars at the top (like "方案 A" and "方案 B"). COMPLETELY REMOVE the white text on these bars. Replace with the EXACT solid color or gradient of the bar itself. There should be NO blurry traces left.
2. PROGRESS BARS & CHARTS: Look for progress bars (gradient bars in containers). REMOVE the text/numbers inside or next to them, but DO NOT REMOVE THE BAR ITSELF. Keep the colored bar's fill and its container shape.
3. TABLE DATA: Remove all text inside the table grid, but keep every single line of the grid structure.
4. NO HALLUCINATION: Do not add new shapes. Do not turn bars into circles. Do not turn icons into blobs.
5. ICON PROTECTION: Preserve all illustrations (e.g., icons of stores, people, clouds, money).
6. RESULT: The final image must be a ready-to-use background template where only the layout and icons remain.`
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