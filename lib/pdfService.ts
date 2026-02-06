import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { Readable } from 'stream';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

// Helper to convert buffer to stream for Drive upload
function bufferToStream(buffer: Buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

export async function generateAndUploadPDF(
  spreadsheetId: string,
  sheetId: string | number, // gid
  pdfName: string,
  folderId: string,
  range: string = "B1:H36",
  isLandscape: boolean = false,
  scale: number = 2
) {
  try {
    // 1. Auth
    const auth = new GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}'),
      scopes: SCOPES,
    });
    const client = await auth.getClient();
    const tokenInfo = await client.getAccessToken();
    const accessToken = tokenInfo.token;

    // 2. Construct Export URL (Legacy Logic)
    const portrait = isLandscape ? 'false' : 'true';
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
      `format=pdf&gid=${sheetId}&range=${range}&` +
      `size=a4&` +
      `portrait=${portrait}&` +
      `scale=${scale}&` +
      `gridlines=false&` +
      `printtitle=false&` +
      `sheetnames=false&` +
      `top_margin=0.75&bottom_margin=0.75&left_margin=0.75&right_margin=0.75`;

    console.log(`📑 Generating PDF from: ${url}`);

    // 3. Fetch PDF Blob
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const pdfBuffer = await response.arrayBuffer();

    // 4. Upload to Drive
    const drive = google.drive({ version: 'v3', auth });

    const fileMetadata = {
      name: pdfName,
      parents: [folderId],
    };

    const media = {
      mimeType: 'application/pdf',
      body: bufferToStream(Buffer.from(pdfBuffer)),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    console.log(`✅ PDF Uploaded: ${file.data.id}`);

    return {
      id: file.data.id,
      viewLink: file.data.webViewLink,
      downloadLink: file.data.webContentLink // or custom logic
    };

  } catch (error) {
    console.error("❌ PDF Generation Error:", error);
    throw error;
  }
}
