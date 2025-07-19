import os
import json
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import fitz  # PyMuPDF
from langchain_groq import ChatGroq
from langchain.prompts import ChatPromptTemplate
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY environment variable is not set. Please set it in your environment. Remove any API keys from your code for security.")
llm = ChatGroq(
    groq_api_key=GROQ_API_KEY,
    model_name="llama3-70b-8192"  # or "llama3-8b-8192", "mixtral-8x7b-32768", etc.
)

@app.post("/parse-pdf/")
async def parse_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Save PDF to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        
        # Extract text from PDF
        doc = fitz.open(tmp_path)
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        os.remove(tmp_path)
        
        # Send to Groq via LangChain
        prompt = ChatPromptTemplate.from_template(
            '''You are a document parser for packing slips issued by paper mills. Your task is to extract a list of paper reel entries from the text of the packing slip.

Each reel must be represented as a JSON object with the following fields:
- "ReelNo": string — must match exactly the reel number printed on the document (e.g., 16732)
- "GSM": number — the grams per square meter (e.g., 48, 58). Extract from a GSM column, header, or context near the top of the file. Assume it is common for all reels unless stated otherwise. Ensure this is a number, not a string.
- "Width": number — width in centimeters (e.g., 74). Again, if mentioned once at the top (e.g., "48-GSM 74"), assume it applies to all unless overridden. Ensure this is a number, not a string.
- "Mill": string — extract the manufacturer name, such as "NICER PAPER MILLS", and assign this value to all reel entries
- "ItemDescription": string — if available per reel, use it; otherwise set to "DT". If the document uses the field name "Quality", map it to "ItemDescription" in the output.
- "Weight": number — weight in kilograms (e.g., 402.00). Ensure it's extracted per reel and not the total weight, and ensure this is a number, not a string.

⚠️ Important Rules:
- Only use valid ReelNo values, which are usually 5-digit numbers in the range of 10000–99999. Do not use "S.No." or serial numbers as ReelNo.
- Width and GSM may appear in a compact form like "48-GSM 74" or "58-GSM 49". Extract both numbers appropriately.
- If Quality is not mentioned, skip or mark it as "UNKNOWN" (not needed unless specified). If you see a field called "Quality", use its value as "ItemDescription" in the output.
- Ignore all headers, totals, summaries, authorized signatory lines, or footer data.
- Ignore any lines that do not contain a valid ReelNo and weight.

✅ Return a flat JSON array with only the reel entries and no additional commentary or summary. Return only valid JSON, with no trailing commas or comments.

📄 Example Output Format:
```json
[
  {{
    "ReelNo": "16732",
    "GSM": 48,
    "Width": 74,
    "Mill": "NICER PAPER MILLS",
    "ItemDescription": "DT",
    "Weight": 380.00
  }},
  {{
    "ReelNo": "16716",
    "GSM": 48,
    "Width": 74,
    "Mill": "NICER PAPER MILLS",
    "ItemDescription": "DT",
    "Weight": 402.00
  }}
]
```
{text}
'''
        )
        chain = prompt | llm
        result = chain.invoke({"text": text})
        raw_content = result.content

        # Try to extract JSON from code block or plain text
        match = re.search(r"```(?:json)?\n?(.*?)```", raw_content, re.DOTALL)
        if match:
            json_str = match.group(1).strip()
        else:
            # Fallback: try to find the first { ... } or [ ... ]
            match = re.search(r"({[\s\S]*})", raw_content) or re.search(r"(\[[\s\S]*\])", raw_content)
            json_str = match.group(1).strip() if match else raw_content.strip()

        # Parse the JSON string to return a proper JSON object
        try:
            parsed_data = json.loads(json_str)
            return JSONResponse(content={"result": parsed_data})
        except json.JSONDecodeError:
            # If JSON parsing fails, return the raw string as fallback
            return JSONResponse(content={"result": json_str, "error": "Failed to parse JSON response"})
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}") 