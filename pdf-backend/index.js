const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());

// Health check
app.get('/', (req, res) => {
  res.send('PDF Extraction Backend is running!');
});

// Helper: Parse reel data from text (simple regex-based, can be improved)
function parseReelData(text) {
  // Example: Reel No: 12345, Weight: 500kg, GSM: 48, Size: 70cm, Mill: Fibremarx, Quality: Dazzle
  const lines = text.split('\n');
  const reels = [];
  for (const line of lines) {
    // Adjust this regex to match your actual PDF format!
    const match = line.match(/Reel\s*No\s*[:\-]?\s*(\w+).*Weight\s*[:\-]?\s*(\d+\.?\d*)\s*kg.*GSM\s*[:\-]?\s*(\d+).*Size\s*[:\-]?\s*(\d+\s*cm).*Mill\s*[:\-]?\s*([\w\s]+).*Quality\s*[:\-]?\s*([\w\s]+)/i);
    if (match) {
      reels.push({
        reelNo: match[1],
        weight: match[2],
        gsm: match[3],
        size: match[4],
        mill: match[5].trim(),
        quality: match[6].trim(),
      });
    }
  }
  return reels;
}

// OCR helper for scanned PDFs (first page only for demo)
async function ocrPdf(filePath) {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvasFactory = new pdfjsLib.NodeCanvasFactory();
  const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
  const renderContext = {
    canvasContext: canvasAndContext.context,
    viewport: viewport,
    canvasFactory: canvasFactory
  };
  await page.render(renderContext).promise;
  const image = canvasAndContext.canvas.toBuffer();
  const { data: { text } } = await Tesseract.recognize(image, 'eng');
  return text;
}

// PDF extraction endpoint
app.post('/extract-reels', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded.' });
  }
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    let text = '';
    let reels = [];
    try {
      // Try text extraction first
      const data = await pdfParse(dataBuffer);
      text = data.text;
      reels = parseReelData(text);
    } catch (err) {
      text = '';
    }
    // If no reels found, try OCR (scanned PDF)
    if (!reels.length) {
      try {
        text = await ocrPdf(req.file.path);
        reels = parseReelData(text);
      } catch (err) {
        // OCR failed
      }
    }
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    res.json({ reels, text });
  } catch (err) {
    console.error('PDF extraction error:', err);
    res.status(500).json({ error: 'Failed to extract PDF.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PDF Extraction Backend running on port ${PORT}`);
}); 