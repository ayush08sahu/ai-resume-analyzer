export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

// Test function to check if PDF.js is working
export async function testPdfJs(): Promise<{ success: boolean; error?: string }> {
    try {
        console.log("Testing PDF.js library...");
        const lib = await loadPdfJs();
        
        if (!lib) {
            return { success: false, error: "Failed to load PDF.js library" };
        }
        
        if (!lib.getDocument) {
            return { success: false, error: "PDF.js library missing getDocument method" };
        }
        
        if (!lib.GlobalWorkerOptions) {
            return { success: false, error: "PDF.js library missing GlobalWorkerOptions" };
        }
        
        console.log("PDF.js library test successful");
        return { success: true };
    } catch (error) {
        console.error("PDF.js test failed:", error);
        return { 
            success: false, 
            error: `PDF.js test failed: ${error instanceof Error ? error.message : String(error)}` 
        };
    }
}

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    isLoading = true;
    
    try {
        console.log("Loading PDF.js library...");
        
        // Try different import methods for better compatibility
        let lib: any;
        try {
            // Method 1: Direct import
            lib = await import("pdfjs-dist");
            console.log("PDF.js imported via direct import");
        } catch (error1) {
            console.log("Direct import failed, trying build import...");
            try {
                // Method 2: Build import
                // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a module
                lib = await import("pdfjs-dist/build/pdf.mjs");
                console.log("PDF.js imported via build import");
            } catch (error2) {
                console.log("Build import failed, using fallback...");
                throw new Error("All PDF.js import methods failed");
            }
        }
        
        console.log("PDF.js library imported successfully");
        
        // Set the worker source to use local file
        const workerSrc = "/pdf.worker.min.mjs";
        console.log("Setting worker source to:", workerSrc);
        lib.GlobalWorkerOptions.workerSrc = workerSrc;
        
        pdfjsLib = lib;
        isLoading = false;
        console.log("PDF.js library loaded and configured");
        return lib;
    } catch (error) {
        console.error("Error in loadPdfJs:", error);
        isLoading = false;
        throw new Error(`Failed to initialize PDF.js: ${error}`);
    }
}

// Fallback function that creates a simple placeholder image
async function createFallbackImage(file: File): Promise<PdfConversionResult> {
    try {
        console.log("Using fallback image creation");
        
        // Create a simple canvas with text
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        
        if (!context) {
            throw new Error("Failed to get canvas context");
        }
        
        canvas.width = 800;
        canvas.height = 600;
        
        // Fill with white background
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add text
        context.fillStyle = "#000000";
        context.font = "24px Arial";
        context.textAlign = "center";
        context.fillText("PDF Preview", canvas.width / 2, canvas.height / 2 - 20);
        context.font = "16px Arial";
        context.fillText(`File: ${file.name}`, canvas.width / 2, canvas.height / 2 + 20);
        context.fillText("PDF to image conversion failed", canvas.width / 2, canvas.height / 2 + 50);
        context.fillText("Using fallback preview", canvas.width / 2, canvas.height / 2 + 80);
        
        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}_fallback.png`, {
                            type: "image/png",
                        });
                        
                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create fallback image",
                        });
                    }
                },
                "image/png",
                0.9
            );
        });
    } catch (error) {
        return {
            imageUrl: "",
            file: null,
            error: `Fallback image creation failed: ${error}`,
        };
    }
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    try {
        console.log("Starting PDF to image conversion for:", file.name);
        console.log("File type:", file.type);
        console.log("File size:", file.size);
        
        // Validate file
        if (!file || file.type !== 'application/pdf') {
            throw new Error('Invalid file type. Only PDF files are supported.');
        }

        // Load PDF.js library
        console.log("Loading PDF.js library...");
        const lib = await loadPdfJs();
        console.log("PDF.js library loaded successfully");

        // Convert file to ArrayBuffer
        console.log("Converting file to ArrayBuffer...");
        const arrayBuffer = await file.arrayBuffer();
        console.log("File converted to ArrayBuffer, size:", arrayBuffer.byteLength);

        // Load PDF document
        console.log("Loading PDF document...");
        const pdf = await lib.getDocument({ 
            data: arrayBuffer,
            verbosity: 0 // Reduce console output
        }).promise;
        console.log("PDF document loaded, pages:", pdf.numPages);

        // Get first page
        console.log("Getting first page...");
        const page = await pdf.getPage(1);
        console.log("First page loaded");

        // Create viewport with appropriate scale
        const viewport = page.getViewport({ scale: 2.0 }); // Reduced scale for better performance
        console.log("Viewport created, dimensions:", viewport.width, "x", viewport.height);
        
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Failed to get canvas context");
        }

        // Set canvas dimensions
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        console.log("Canvas created with dimensions:", canvas.width, "x", canvas.height);

        // Configure rendering context
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        // Render page to canvas
        console.log("Rendering page to canvas...");
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        await page.render(renderContext).promise;
        console.log("Page rendered to canvas successfully");

        // Convert canvas to blob
        console.log("Converting canvas to blob...");
        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        console.log("Canvas converted to blob, size:", blob.size);
                        
                        // Create a File from the blob with the same name as the pdf
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}.png`, {
                            type: "image/png",
                        });

                        const imageUrl = URL.createObjectURL(blob);
                        console.log("Image URL created:", imageUrl);

                        resolve({
                            imageUrl: imageUrl,
                            file: imageFile,
                        });
                    } else {
                        console.error("Failed to create image blob");
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob from canvas",
                        });
                    }
                },
                "image/png",
                0.9 // Slightly reduced quality for better performance
            );
        });

    } catch (err) {
        console.error("PDF to image conversion failed:", err);
        
        // Try fallback if PDF.js failed
        if (err instanceof Error && err.message.includes("Failed to load PDF.js")) {
            console.log("Attempting fallback image creation");
            return await createFallbackImage(file);
        }
        
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF to image: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}

// Alternative simple PDF to image conversion (creates placeholder)
export async function convertPdfToImageSimple(
    file: File
): Promise<PdfConversionResult> {
    try {
        console.log("Using simple PDF to image conversion for:", file.name);
        
        // Create a simple canvas with PDF preview
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        
        if (!context) {
            throw new Error("Failed to get canvas context");
        }
        
        canvas.width = 800;
        canvas.height = 600;
        
        // Fill with white background
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add a PDF icon or preview
        context.fillStyle = "#e74c3c";
        context.fillRect(50, 50, 100, 120);
        context.fillStyle = "#ffffff";
        context.font = "bold 48px Arial";
        context.textAlign = "center";
        context.fillText("PDF", 100, 120);
        
        // Add file information
        context.fillStyle = "#2c3e50";
        context.font = "bold 24px Arial";
        context.textAlign = "left";
        context.fillText("PDF Document", 200, 80);
        
        context.font = "16px Arial";
        context.fillText(`File: ${file.name}`, 200, 110);
        context.fillText(`Size: ${(file.size / 1024).toFixed(1)} KB`, 200, 135);
        context.fillText("Preview not available", 200, 160);
        context.fillText("Using placeholder image", 200, 185);
        
        // Add some decorative elements
        context.strokeStyle = "#bdc3c7";
        context.lineWidth = 2;
        context.strokeRect(180, 60, 400, 150);
        
        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}_preview.png`, {
                            type: "image/png",
                        });
                        
                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create preview image",
                        });
                    }
                },
                "image/png",
                0.9
            );
        });
    } catch (error) {
        return {
            imageUrl: "",
            file: null,
            error: `Simple conversion failed: ${error}`,
        };
    }
}