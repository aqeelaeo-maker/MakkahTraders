import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const FBR_SANDBOX_POST_URL = "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb";
const FBR_SANDBOX_VALIDATE_URL = "https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb";
const FBR_TOKEN = "819159d4-21cb-3e97-9137-24bc59f7fc6c";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route to post invoice to FBR
  app.post("/api/fbr/invoice", async (req, res) => {
    try {
      const invoiceData = req.body;
      
      const response = await fetch(FBR_SANDBOX_POST_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FBR_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invoiceData)
      });

      const data = await response.text();
      
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        parsedData = data;
      }

      if (!response.ok) {
        return res.json({ success: false, error: parsedData, status: response.status });
      }

      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("FBR API Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API route to validate invoice data to FBR Sandbox
  app.post("/api/fbr/validate-invoice", async (req, res) => {
    try {
      const invoiceData = req.body;
      
      const response = await fetch(FBR_SANDBOX_VALIDATE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FBR_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invoiceData)
      });

      const data = await response.text();
      
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        parsedData = data;
      }

      if (!response.ok) {
        return res.json({ success: false, error: parsedData, status: response.status });
      }

      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("FBR Validate API Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
