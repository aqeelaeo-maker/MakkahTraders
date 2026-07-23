const FBR_SANDBOX_POST_URL = "https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb";
const FBR_TOKEN = "819159d4-21cb-3e97-9137-24bc59f7fc6c";

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
      return res.status(200).json({ success: false, error: parsedData, status: response.status });
    }

    return res.status(200).json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("FBR API Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
