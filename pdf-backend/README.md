# PDF Extraction Backend

This is a Node.js/Express backend for extracting reel data from PDF files (text-based or scanned).

## Features
- POST `/extract-reels`: Upload a PDF, get extracted reel data and raw text (JSON)
- Handles both text-based and scanned PDFs (OCR)
- CORS enabled for frontend integration

## Local Development
```bash
npm install
node index.js
```

## Deploying to Vercel
1. Push this folder to a new GitHub repository.
2. Go to [Vercel](https://vercel.com/) and import your repo.
3. Vercel will auto-detect the `vercel.json` and deploy your API.
4. After deployment, your endpoints will be available at:
   - `https://your-vercel-url.vercel.app/extract-reels`

## Usage
- Use a tool like Postman or your frontend to POST a PDF file as `multipart/form-data` with the field name `pdf` to `/extract-reels`.
- The response will be `{ reels: [...], text: "..." }` with the extracted data and raw text.

## Next Steps
- Improve the regex in `parseReelData` to match your actual PDF format.
- Secure the endpoint if needed. 