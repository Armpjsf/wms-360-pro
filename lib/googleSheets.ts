import { google } from "googleapis";
import path from "path";
import stream from "stream";
import { getOAuth2Client } from './oauthClient';
import { unstable_cache, revalidateTag } from 'next/cache';

// Function to get the Sheets API client
export async function getGoogleSheets() {
  try {
    let auth;
    
    // Check if environment variables are available (Vercel deployment)
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      console.log("Using Google Service Account from environment variables");
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive"
        ],
      });
    } else {
      // Fallback to JSON file for local development
      console.log("Using Google Service Account from service-key.json");
      auth = new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), "service-key.json"),
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive"
        ],
      });
    }

    const client = await auth.getClient();
    const googleSheets = google.sheets({ version: "v4", auth: client as any });

    return { googleSheets, auth, client };
  } catch (error) {
    console.error("Error authenticating to Google Sheets:", error);
    throw error;
  }
}

export async function getServiceAccountEmail(): Promise<string> {
    const { auth } = await getGoogleSheets();
    try {
        const creds = await auth.getCredentials();
        return creds.client_email || "Unknown Service Account";
    } catch (e) {
        console.error("Failed to get service account email:", e);
        return "Unknown Service Account";
    }
}

export async function getGoogleDrive() {
    const { auth, client } = await getGoogleSheets();
    const drive = google.drive({ version: 'v3', auth: client as any });
    return { drive, auth };
}

export function cleanSpreadsheetId(id: string | undefined): string {
    if (!id) return "";
    // Check if it's a URL
    const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return match[1];
    }
    return id;
}

// CONSTANTS (From User)
export const PRODUCT_SHEET_GID = 1511150723;

// SPLIT SPREADSHEET CONFIGURATION
// ID 1: Product Data (Inventory, Master)
export const PRODUCT_SPREADSHEET_ID = cleanSpreadsheetId(process.env.PRODUCT_SPREADSHEET_ID) || '1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM';
// ID 2: Documents & Logs (Transactions, POs)
export const DOC_SPREADSHEET_ID = cleanSpreadsheetId(process.env.DOC_SPREADSHEET_ID) || cleanSpreadsheetId(process.env.NEXT_PUBLIC_SPREADSHEET_ID) || '';
// Legacy Fallback (defaults to Doc ID)
export const SPREADSHEET_ID = DOC_SPREADSHEET_ID;

// Helper to get Sheet Name by GID (Cached)
export const getProductSheetName = unstable_cache(
  async () => {
    const { googleSheets, auth } = await getGoogleSheets();
    try {
      // Use the SPREADSHEET_ID exported below (or hardcode if circular dependency issue, but usually fine due to hoisting or module resolution)
      // To be safe, I'll use the ID string directly here to avoid issues if SPREADSHEET_ID is defined lower down.
      const SSID = '1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM';
      const meta = await googleSheets.spreadsheets.get({
        auth: auth as any,
        spreadsheetId: SSID,
        fields: 'sheets.properties'
      });
      const sheet = meta.data.sheets?.find(s => s.properties?.sheetId === PRODUCT_SHEET_GID);
      // Validating against null/undefined title
      if (!sheet?.properties?.title) throw new Error("Product Sheet not found by GID: " + PRODUCT_SHEET_GID);
      return sheet.properties.title;
    } catch (error) {
       console.error("Failed to resolve Product Sheet Name:", error);
       throw error;
    }
  },
  ['product-sheet-name'],
  { revalidate: 3600 } // Cache for 1 hour
);

// Helper to get Sheet ID (GID) by Name
export async function getSheetId(spreadsheetId: string, sheetName: string): Promise<number | null> {
    const { googleSheets, auth } = await getGoogleSheets();
    try {
        const response = await googleSheets.spreadsheets.get({
            auth: auth as any,
            spreadsheetId,
            fields: 'sheets(properties(sheetId,title))'
        });

        const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName);
        return sheet?.properties?.sheetId || null;
    } catch (error) {
        console.error(`Error getting sheet ID for ${sheetName}:`, error);
        return null;
    }
}



// Find ALL rows matches (for multiple items in one Doc)
export async function findAllRowIndices(spreadsheetId: string, sheetName: string, colIndex: number, value: string): Promise<number[]> {
   const data = await getSheetData(spreadsheetId, `'${sheetName}'!A:H`);
   const indices = [];
   if (!data) return [];
   
   const targetVal = String(value).trim();

   for (let i = 0; i < data.length; i++) {
       const cellVal = data[i][colIndex] ? String(data[i][colIndex]).trim() : "";
       if (cellVal === targetVal) {
           indices.push(i + 1);
       }
   }
   return indices;
}

export async function getSheetPdfBlob(
    spreadsheetId: string, 
    sheetId: number, 
    range: string = 'A1:H20',
    landscape: boolean = true
): Promise<ArrayBuffer> {
    const { auth } = await getGoogleSheets();
    const token = await auth.getAccessToken();
    
    // Construct Export URL (Matching Legacy Parameters)
    // Legacy: scale=2 (Fit to Page?), portrait=false, A4
    // Note: 'scale' param in new export URL might be different or 'fitToWidth'. 
    // Legacy used: scale=2. Let's try to match.
    // Legacy: top_margin=0.75&bottom_margin=0.75&left_margin=0.75&right_margin=0.75
    
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=pdf` +
                `&gid=${sheetId}` +
                `&range=${range}` +
                `&size=a4` +
                `&portrait=${!landscape}` +
                `&scale=2` + 
                `&gridlines=false` +
                `&printtitle=false` + 
                `&sheetnames=false` +
                `&top_margin=0.75&bottom_margin=0.75&left_margin=0.75&right_margin=0.75`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`PDF Export Failed: ${res.statusText}`);
    return await res.arrayBuffer();
}

// Legacy export function (kept for reference or backward compatibility if needed, but we are replacing it for pure blob fetch)
// We'll leave the old 'exportSheetToPdf' signature commented out or removed if unused.
// Replaced by getSheetPdfBlob for direct streaming.

// Helper to get all values from a spreadsheet
export async function getSheetData(spreadsheetId: string, range: string) {
  const { googleSheets, auth } = await getGoogleSheets();

  try {
    const response = await googleSheets.spreadsheets.values.get({
      auth: auth as any,
      spreadsheetId,
      range,
    });

    return response.data.values || [];
  } catch (error) {
    console.error(`Error reading sheet range ${range}:`, error);
    return null;
  }
}

// Helper to get raw formulas from a spreadsheet
export async function getSheetFormula(spreadsheetId: string, range: string) {
  // Force rebuild
  const { googleSheets, auth } = await getGoogleSheets();

  try {
    const response = await googleSheets.spreadsheets.values.get({
      auth: auth as any,
      spreadsheetId,
      range,
      valueRenderOption: 'FORMULA', // Get Raw Formula
    });

    return response.data.values || [];
  } catch (error) {
    console.error(`Error reading sheet formulas ${range}:`, error);
    return [];
  }
}

// Helper to update values in a spreadsheet
export async function updateSheetData(spreadsheetId: string, range: string, values: any[][]) {
  const { googleSheets, auth } = await getGoogleSheets();
  try {
    await googleSheets.spreadsheets.values.update({
       auth: auth as any,
       spreadsheetId,
       range,
       valueInputOption: "USER_ENTERED",
       requestBody: {
           values: values
       }
    });
    // Invalidate cache for relevant tags
    // @ts-ignore
    revalidateTag('products');
    // @ts-ignore
    revalidateTag('transactions');
    // @ts-ignore
    revalidateTag('dashboard'); // Ensure dashboard updates too
  } catch (error) {
    console.error(`Error updating sheet range ${range}:`, error);
    throw error;
  }
}

// Helper to append values to a spreadsheet
export async function appendSheetRow(spreadsheetId: string, range: string, rowData: any[]) {
    const { googleSheets, auth } = await getGoogleSheets();
    try {
        await googleSheets.spreadsheets.values.append({
            auth: auth as any,
            spreadsheetId,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [rowData]
            }
        });
        // Invalidate cache immediately
        // @ts-ignore
        revalidateTag('products');
        // @ts-ignore
        revalidateTag('transactions');
        // @ts-ignore
        revalidateTag('dashboard');
    } catch (error) {
        console.error(`Error appending to sheet ${range}:`, error);
        throw error;
    }
}

export async function appendSheetData(spreadsheetId: string, range: string, values: any[][]) {
    const { googleSheets, auth } = await getGoogleSheets();
    try {
        await googleSheets.spreadsheets.values.append({
            auth: auth as any,
            spreadsheetId,
            range,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: values
            }
        });
        // Invalidate cache immediately
        // @ts-ignore
        revalidateTag('products');
        // @ts-ignore
        revalidateTag('transactions');
        // @ts-ignore
        revalidateTag('dashboard');
    } catch (error) {
        console.error(`Error appending batch to sheet ${range}:`, error);
        throw error;
    }
}

// Helper to clear values in a range
export async function clearSheetRange(spreadsheetId: string, range: string) {
    const { googleSheets, auth } = await getGoogleSheets();
    try {
        await googleSheets.spreadsheets.values.clear({
            auth: auth as any,
            spreadsheetId,
            range
        });
    } catch (error) {
        console.error(`Error clearing sheet range ${range}:`, error);
        throw error;
    }
}

// Helper to ensure a sheet exists, creating it if necessary
export async function ensureSheetExists(spreadsheetId: string, sheetName: string, headers: string[] = []) {
    const { googleSheets, auth } = await getGoogleSheets();
    
    // 1. Check if exists
    const sheetId = await getSheetId(spreadsheetId, sheetName);
    if (sheetId !== null) return; // Exists

    console.log(`[GoogleSheets] Sheet '${sheetName}' missing. Creating...`);

    try {
        // 2. Create Sheet
        await googleSheets.spreadsheets.batchUpdate({
            auth: auth as any,
            spreadsheetId,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: { title: sheetName }
                    }
                }]
            }
        });

        // 3. Add Headers if provided
        if (headers.length > 0) {
            await googleSheets.spreadsheets.values.update({
                auth: auth as any,
                spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    values: [headers]
                }
            });
        }
        console.log(`[GoogleSheets] Sheet '${sheetName}' created successfully.`);
    } catch (error) {
        console.error(`Error creating sheet '${sheetName}':`, error);
        // Don't throw, let the subsequent append fail with a native error if this failed, 
        // or throw to stop early. Better to throw to inform API.
        throw new Error(`Failed to create sheet '${sheetName}': ${(error as Error).message}`);
    }
}

interface RollTagItem {
  orderNo: string;
  itemCode: string;
  quantity: number;
}

interface CustomerData {
  customerId: string;
  items: RollTagItem[];
}

interface POItem {
    itemCode: string;
    quantity: number;
    unit: string;
    price: number;
}

interface POLogEntry {
    date: string;
    po_number: string;
    supplier: string;
    items: POItem[];
    total: number;
    status: string;
    notes: string;
    received_date: string;
    received_by: string;
}


export async function getPOLog(): Promise<POLogEntry[]> {
    try {
        const SPREADSHEET_ID = cleanSpreadsheetId(process.env.NEXT_PUBLIC_PO_SPREADSHEET_ID);
        if (!SPREADSHEET_ID) {
            console.error("SPREADSHEET_ID not configured");
            return [];
        }

        let rawData: any[][] | null = null;
        try {
            rawData = await getSheetData(SPREADSHEET_ID, "คลังข้อมูล!A:I");
        } catch (err) {
            console.error("Error reading คลังข้อมูล sheet:", err);
            return [];
        }

        if (!rawData || rawData.length === 0) return [];

        const entries: POLogEntry[] = [];
        for (let i = 0; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length < 5) continue;

            const date = row[0] || "";
            const po = row[1] || "";
            const supplier = row[2] || "";
            const itemsRaw = row[3] || "";
            const totalRaw = row[4] || "";
            const status = row[5] || "Pending";
            const notes = row[6] || "";
            const receivedDate = row[7] || "";
            const receivedBy = row[8] || "";

            if (!po) continue;

            let items: POItem[] = [];
            try {
                items = JSON.parse(itemsRaw);
            } catch {
                items = [];
            }

            const total = parseFloat(totalRaw) || 0;

            entries.push({
                date,
                po_number: po,
                supplier,
                items,
                total,
                status,
                notes,
                received_date: receivedDate,
                received_by: receivedBy
            });
        }

        return entries;
    } catch (error) {
        console.error("Error in getPOLog:", error);
        return [];
    }
}
export async function writeRollTagData(spreadsheetId: string, sheetName: string, data: CustomerData) {
    const { googleSheets, auth } = await getGoogleSheets();
    
    try {
        // 1. Prepare Data
        const customerId = data.customerId;
        const items = data.items;
        const MAX_ROWS = 9;
        
        const ordersForForm: string[][] = [];
        const itemsForForm: string[][] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const qtyForForm: any[][] = [];
        const formulasForForm: string[][] = [];
        
        let lastOrderNoWritten = "";
        
        for (let i = 0; i < MAX_ROWS; i++) {
            // Formula for C column: =IFERROR(VLOOKUP(B{Row}, Items!A:B, 2, FALSE), "")
            const rowNum = 9 + i;
            formulasForForm.push([`=IFERROR(VLOOKUP(B${rowNum}, Items!A:B, 2, FALSE), "")`]);

            if (i < items.length) {
                const item = items[i];
                const currentOrder = item.orderNo;
                
                if (currentOrder && currentOrder === lastOrderNoWritten) {
                     ordersForForm.push([""]);
                } else {
                     ordersForForm.push([currentOrder]);
                     lastOrderNoWritten = currentOrder;
                }
                
                itemsForForm.push([item.itemCode]);
                qtyForForm.push([item.quantity]);
            } else {
                ordersForForm.push([""]);
                itemsForForm.push([""]);
                qtyForForm.push([""]);
            }
        }
        
        // 2. Clear Arguments (Legacy: B4, A9:B17, D9:E17)
        // Batch clear is not directly available in this helper setup easily without raw client, 
        // but we can just overwrite or clear sequentially. 
        // Legacy uses batch_clear. Let's try to be safe and use update with empty strings if needed, 
        // but since we are constructing full 9-row arrays, overwriting is safer than clearing + writing.
        // However, D9:E17 clear is important if we only write to E. D might have leftover trash?
        // Legacy writes to E, D is cleared.
        
        // Let's use batchUpdate if possible for atomicity, but googleSheets.spreadsheets.values.batchUpdate is the way.
        
        const updates = [
            { range: `${sheetName}!B4`, values: [[customerId]] },
            { range: `${sheetName}!A9:A17`, values: ordersForForm },
            { range: `${sheetName}!B9:B17`, values: itemsForForm },
            { range: `${sheetName}!C9:C17`, values: formulasForForm }, // Added Formulas
            { range: `${sheetName}!E9:E17`, values: qtyForForm }
        ];

        // We also want to clear D9:D17 (Legacy clears D9:E17, writes E9:E17). 
        // So effectively D9:D17 is cleared.
        const emptyCol: string[][] = Array(9).fill([""]);
        updates.push({ range: `${sheetName}!D9:D17`, values: emptyCol });

        await googleSheets.spreadsheets.values.batchUpdate({
            auth: auth as any,
            spreadsheetId,
            requestBody: {
                valueInputOption: "USER_ENTERED",
                data: updates
            }
        });
        
        console.log(`Successfully wrote to ${sheetName} for Customer ${customerId}`);
        return true;

    } catch (error) {
        console.error(`Error writing Roll Tag to ${sheetName}:`, error);
        throw error;
    }
}

// ⚠️ IMPORTANT: Spreadsheet IDs Configuration ⚠️

// 1. Main Inventory & Transactions (Original Data)
export const SPREADSHEET_ID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM"; 
export const INVENTORY_SPREADSHEET_ID = SPREADSHEET_ID;

// 2. User Management (New Sheet)
export const USER_SPREADSHEET_ID = "1rdTdtzGvW0bF8bLF-KLjqn3_kKTFDnBdEEpXtegCPbg";

// 3. PO Logs (Check which sheet contains 'คลังข้อมูล')
// If uncertain, we often check both in getPOLogs, but let's default to Main if that's where it was.
// The comment previously linked it to the NEW ID, but let's be careful. 
// If 'คลังข้อมูล' was in the original sheet, use SPREADSHEET_ID.
export const PO_SPREADSHEET_ID = USER_SPREADSHEET_ID; // The "Form Link Mail" sheet contains "คลังข้อมูล" 

export const DELIVERY_FOLDER_ID = "1QGOYQUX8eDxmzuZ6pbiXJH5iuKAZG8s3"; // Folder for Delivery PDFs

// ============================================================================
// CORE DATA FUNCTIONS (REAL)
// ============================================================================

export interface Product {
    id: string;
    name: string;
    category: string;
    stock: number;
    price: number;
    unit: string;
    image: string;
    status: string;
    minStock: number;
    location: string;
}

// Internal fetcher (uncached) - Exported for Data Quality Check
export async function getProductsUncached(targetSheetId: string = SPREADSHEET_ID): Promise<Product[]> {
    try {
        // Try '📊 รายงานสินค้าคงเหลือ' first (User specific)
        let rawData = await getSheetData(targetSheetId, "'📊 รายงานสินค้าคงเหลือ'!A1:Z1000");
        
        // Fallback to 'ชื่อสินค้า' if not found
        if (!rawData || rawData.length < 2) {
             console.log("Sheet '📊 รายงานสินค้าคงเหลือ' not found or empty, trying 'ชื่อสินค้า'...");
             rawData = await getSheetData(targetSheetId, "'ชื่อสินค้า'!A1:Z1000");
        }

        if (!rawData || rawData.length < 2) return [];

        const headers = rawData[0].map((h: string) => h.trim());
        const rows = rawData.slice(1);

        // Map Header Columns (Legacy Compatibility)
        const getColIndex = (keywords: string[]) => headers.findIndex((h: string) => {
            const headerVal = h.trim();
            return keywords.some(k => headerVal === k || headerVal.includes(k));
        });

        const idxName = getColIndex(['ชื่อสินค้า', 'product_name', 'item_name']);
        const idxCat = getColIndex(['กลุ่มสินค้า', 'category', 'group']);
        const idxPrice = getColIndex(['ราคามาตรฐาน', 'ราคา', 'price', 'cost']); 
        const idxStock = getColIndex(['จำนวนสินค้าคงเหลือ', 'จำนวนคงเหลือ', 'คงเหลือ', 'Stock', 'Balance', 'จำนวน']);
        const idxUnit = getColIndex(['หน่วยนับ', 'unit']);
        const idxImgLink = getColIndex(['ลิงค์', 'link', 'drive', 'url']);
        const idxImgNormal = getColIndex(['รูป', 'image', 'picture', 'photo']);
        const idxStatus = getColIndex(['Status', 'status', 'สถานะ', 'สถานะการเติมสินค้า', 'สถานะสินค้า']);
        const idxMin = getColIndex(['จำนวนขั้นต่ำ', 'min', 'safety_stock']);
        let idxLocation = getColIndex(['Location', 'location', 'ที่เก็บ', 'ตำแหน่ง', 'Shelf', 'shelf', 'Zone', 'zone']);
        
        if (idxLocation === -1) {
            // console.log("Location header not found, defaulting to Column Q");
            idxLocation = 16;
        }

        return rows.map((row: string[], i: number) => {
            if (!row[idxName]) return null; // Skip empty names
            
            // Resolve Image
            let imgVal = (idxImgLink > -1 && row[idxImgLink]) ? row[idxImgLink] : 
                          ((idxImgNormal > -1 && row[idxImgNormal]) ? row[idxImgNormal] : "");

            if (imgVal && imgVal.includes('drive.google.com')) {
                const driveMatch = imgVal.match(/\/d\/([a-zA-Z0-9_-]+)/);
                const idMatch = imgVal.match(/id=([a-zA-Z0-9_-]+)/);
                if (driveMatch && driveMatch[1]) imgVal = `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
                else if (idMatch && idMatch[1]) imgVal = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
            }

            return {
                id: `P-${i+1}`, 
                name: row[idxName] || "Unknown",
                category: idxCat > -1 ? row[idxCat] : "General",
                stock: idxStock > -1 ? parseFloat(row[idxStock]?.replace(/,/g, '') || "0") : 0,
                price: idxPrice > -1 ? parseFloat(row[idxPrice]?.replace(/,/g, '') || "0") : 0,
                unit: idxUnit > -1 ? row[idxUnit] : "pcs",
                image: imgVal,
                status: idxStatus > -1 ? row[idxStatus] : "Active",
                minStock: idxMin > -1 ? parseFloat(row[idxMin]?.replace(/,/g, '') || "0") : 0,
                location: idxLocation > -1 ? row[idxLocation] : "-"
            };
        }).filter(p => p !== null) as Product[];

    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
}

// -------------------------------------------------------------
// CACHED WRAPPER (Now supports Branch ID)
// -------------------------------------------------------------
export const getProducts = unstable_cache(
    async (branchSheetId?: string) => {
        return getProductsUncached(branchSheetId || SPREADSHEET_ID);
    },
    ['products-list'], 
    { revalidate: 300, tags: ['products'] }
);

export async function editProduct(oldName: string, updates: any) {
    const sheetName = await getProductSheetName();
    const data = await getSheetData(SPREADSHEET_ID, `'${sheetName}'!A1:Z2000`);
    if (!data || data.length < 2) return false;

    const headers = data[0];
    const rows = data.slice(1);

    // Map Indices Dynamically (or hardcode if trust screenshot)
    // Let's trust logic but double check headers if possible, or fallback to fixed indices if headers match known pattern
    // Screenshot: A=Location, B=Name ...
    // Let's use getColIndex logic to be safe, but fallback to Fixed.
    
    // Header Mapping Helpers
    const getIdx = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));
    
    // Key Indices
    const idxName = getIdx(['ชื่อสินค้า', 'Name']);
    if (idxName === -1) {
         // Fallback to Column B (Index 1) if name not found by header
         // console.warn("Name header not found, checking Col B");
    }

    // Find Row
    // If idxName found, use it. Else assume Col B (1).
    const SEARCH_COL = idxName > -1 ? idxName : 1; 

    const rowIndex = rows.findIndex(r => r[SEARCH_COL]?.toString().trim() === oldName.trim());
    if (rowIndex === -1) {
        console.error(`Product not found for edit: ${oldName}`);
        return false;
    }
    const realRow = rowIndex + 2;

    const updatePromises: Promise<any>[] = [];
    
    // Helper to push update with explicit Column Letter Mapping (Based on Screenshot)
    // A: Location, B: Name, C: Cost, D: Price, E: Unit, F: Min, G: Cat, H: Status, I: Img
    const mapCol = {
        location: 'A',
        name: 'B',
        cost: 'C',
        price: 'D',
        unit: 'E',
        minStock: 'F',
        category: 'G', 
        status: 'H',
        image: 'I'
    };

    const push = (col: string, val: any) => {
        if (!val) return;
        const range = `'${sheetName}'!${col}${realRow}`;
        updatePromises.push(updateSheetData(SPREADSHEET_ID, range, [[val]]));
    };

    if (updates.name && updates.name !== oldName) push(mapCol.name, updates.name);
    if (updates.location) push(mapCol.location, updates.location);
    if (updates.cost) push(mapCol.cost, updates.cost);
    if (updates.price) push(mapCol.price, updates.price);
    if (updates.unit) push(mapCol.unit, updates.unit);
    if (updates.minStock) push(mapCol.minStock, updates.minStock);
    if (updates.category) push(mapCol.category, updates.category);
    if (updates.status) push(mapCol.status, updates.status);
    if (updates.image) push(mapCol.image, updates.image);

    if (updatePromises.length > 0) await Promise.all(updatePromises);

    // @ts-ignore
    revalidateTag('products');
    return true;
}


async function resolveTransactionSheetName(type: 'IN' | 'OUT'): Promise<string> {
    const emojiName = type === 'IN' ? '💸 Transaction รับ' : '💰 Transaction จ่าย';
    const cleanName = type === 'IN' ? 'Transaction รับ' : 'Transaction จ่าย';
    
    // Check Emoji First (Lightweight check)
    const test = await getSheetData(SPREADSHEET_ID, `'${emojiName}'!A1`);
    if (test !== null) return emojiName; // Exists
    
    return cleanName; // Fallback
}

export async function addTransaction(type: 'IN' | 'OUT', data: any) {
    const sheetName = await resolveTransactionSheetName(type);
    
    // Invalidate cache immediately on write
    // @ts-ignore
    revalidateTag('transactions');
    // @ts-ignore
    revalidateTag('products');
    // @ts-ignore
    revalidateTag('dashboard');
    
    // Find next row for formula references
    const existingData = await getSheetData(SPREADSHEET_ID, `'${sheetName}'!A:A`);
    const rowNum = (existingData?.length || 0) + 1;

    // Format date: DD/MM/YYYY Buddhist Era (Thai format)
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const bangkokOffset = 7 * 60 * 60 * 1000;
    const thDate = new Date(utc + bangkokOffset);
    const dateStr = data.date || `${thDate.getDate()}/${thDate.getMonth() + 1}/${thDate.getFullYear() + 543}`;

    let row: any[];
    let range: string;

    if (type === 'OUT') {
        // =============================================
        // OUT (จ่าย) - 12 columns (A-L) with profit formulas
        // =============================================
        // A: วันที่ (Date)
        // B: ชื่อสินค้า (SKU)
        // C: จำนวนที่ขาย (Qty)
        // D: ราคา (Price)
        // E: หน่วยนับ (Unit)
        // F: มูลค่ารวม (Formula: =C*D)
        // G: ต้นทุนเฉลี่ยรวม (Formula: VLOOKUP cost * qty)
        // H: กำไรขั้นต้น (Formula: =F-G)
        // I: %กำไรขั้นต้น (Formula: =H/F)
        // J: กลุ่มสินค้า (Formula: VLOOKUP category)
        // K: หมายเหตุ (Formula: VLOOKUP notes)
        // L: Order/DocRef

        const formulaF = `=IF(LEN(B${rowNum})>0, C${rowNum} * D${rowNum}, "")`;
        const formulaG = `=IF(LEN(B${rowNum})>0, IFERROR(VLOOKUP(B${rowNum}, '📊 รายงานสินค้าคงเหลือ'!A:G, 6, FALSE) * C${rowNum}, 0), 0)`;
        const formulaH = `=IF(LEN(B${rowNum})>0, F${rowNum} - G${rowNum}, 0)`;
        const formulaI = `=IF(LEN(B${rowNum})>0, IF(F${rowNum}<>0, H${rowNum} / F${rowNum}, 0), 0)`;
        const formulaJ = `=IFERROR(IF(B${rowNum}<>"", VLOOKUP(B${rowNum}, 'ชื่อสินค้า'!B:G, 6, 0), ""), "")`;
        const formulaK = `=IFERROR(VLOOKUP(B${rowNum}, '📊 รายงานสินค้าคงเหลือ'!A:Q, 17, 0), "")`;

        row = [
            dateStr,                    // A: วันที่
            data.sku,                   // B: ชื่อสินค้า
            data.qty,                   // C: จำนวน
            data.price || 0,            // D: ราคา
            data.unit || 'แผ่น',        // E: หน่วยนับ
            formulaF,                   // F: มูลค่ารวม
            formulaG,                   // G: ต้นทุนเฉลี่ยรวม
            formulaH,                   // H: กำไรขั้นต้น
            formulaI,                   // I: %กำไรขั้นต้น
            formulaJ,                   // J: กลุ่มสินค้า
            formulaK,                   // K: หมายเหตุ
            data.docRef || ''           // L: Order/DocRef
        ];
        range = `'${sheetName}'!A${rowNum}:L${rowNum}`;

    } else {
        // =============================================
        // IN (รับ) - 7 columns (A-G) 
        // =============================================
        // A: วันที่ (Date)
        // B: ชื่อสินค้า (SKU)
        // C: จำนวนที่ซื้อ (Qty)
        // D: ราคา (Price) - lookup from ชื่อสินค้า!C if not provided
        // E: หน่วยนับ (Unit) - แผ่น
        // F: มูลค่ารวม (Formula)
        // G: หมายเหตุ (ใส่ location - text, not formula)

        // Lookup cost price from ชื่อสินค้า sheet if not provided
        let costPrice = data.price;
        if (!costPrice || costPrice === 0) {
            try {
                // ชื่อสินค้า Sheet: B = ชื่อสินค้า, C = ราคาซื้อ
                const productData = await getSheetData(SPREADSHEET_ID, "'ชื่อสินค้า'!B:C");
                if (productData) {
                    const found = productData.find(row => row[0] === data.sku);
                    if (found && found[1]) {
                        costPrice = parseFloat(String(found[1]).replace(/,/g, '')) || 0;
                    }
                }
            } catch (e) {
                console.error('[addTransaction] Cost lookup failed:', e);
                costPrice = 0;
            }
        }

        const formulaF = `=IF(LEN(INDIRECT("B"&ROW()))>0, INDIRECT("C"&ROW()) * INDIRECT("D"&ROW()), "")`;

        row = [
            dateStr,                    // A: วันที่
            data.sku,                   // B: ชื่อสินค้า
            data.qty,                   // C: จำนวนที่ซื้อ
            costPrice || 0,             // D: ราคา (from ชื่อสินค้า!C)
            data.unit || 'แผ่น',        // E: หน่วยนับ
            formulaF,                   // F: มูลค่ารวม (Formula)
            data.docRef || data.location || ''  // G: หมายเหตุ (location)
        ];
        range = `'${sheetName}'!A${rowNum}:G${rowNum}`;
    }

    // Use updateSheetData to write formulas correctly
    await updateSheetData(SPREADSHEET_ID, range, [row]);
    return true;
}

export async function addProduct(data: any): Promise<boolean> {
   const sheetName = await getProductSheetName();
   console.log(`[addProduct] Resolved Sheet Name: ${sheetName}`);
   if (!sheetName) throw new Error("Could not resolve Product Sheet Name");

   // Map Data to Columns based on User Screenshot / Standard
   // A: Location
   // B: Name (Key)
   // C: Buy Price
   // D: Sell Price
   // E: Unit
   // F: Min Qty
   // G: Category
   // H: Status (Active)
   // I: Image URL (Direct)
   // J: Drive Link
   
   const row = [
      data.location || "-",      // A
      data.name,                 // B
      data.cost || 0,            // C
      data.price || 0,           // D
      data.unit || "ชิ้น",       // E
      data.minStock || 0,        // F
      data.category || "General",// G
      "Active",                  // H
      data.image || "",          // I
      ""                         // J (Drive Link - usually empty if direct link used)
   ];

   await appendSheetRow(SPREADSHEET_ID, `'${sheetName}'!A:J`, row);
   return true;
}

export interface Transaction {
    date: string;
    type: 'IN' | 'OUT';
    sku: string;
    qty: number;
    price: number; // Cost for IN, Sale Price for OUT
    docRef?: string;
    product?: string; // Legacy field match
    timestamp?: number; // Sorting helper
    // Enterprise Fields (Phase 14)
    batch?: string;      // Batch/Lot Number
    expiryDate?: string; // Expiry Date (YYYY-MM-DD)
    owner?: string;      // Owner/Customer for 3PL isolation
}

// Cached fetcher for Transaction History
export const getAllTransactions = unstable_cache(
    async (): Promise<Transaction[]> => {
        try {
            // Fetch Trans In & Trans Out parallel
            const [inData, outData] = await Promise.all([
                getSheetData(SPREADSHEET_ID, "'💸 Transaction รับ'!A:G"),
                getSheetData(SPREADSHEET_ID, "'💰 Transaction จ่าย'!A:G")
            ]);

            const transactions: Transaction[] = [];

            // Parse IN (Skip Header)
            if (inData && inData.length > 1) {
                inData.slice(1).forEach(row => {
                    // A: Date, B: Name, C: Qty, D: Price
                    if (!row[1]) return;
                    transactions.push({
                        date: row[0],
                        type: 'IN',
                        sku: row[1],
                        qty: parseFloat(row[2]?.replace(/,/g, '') || "0"),
                        price: parseFloat(row[3]?.replace(/,/g, '') || "0"),
                        docRef: row[6] || ""
                    });
                });
            }

            // Parse OUT (Skip Header)
            if (outData && outData.length > 1) {
                outData.slice(1).forEach(row => {
                     // A: Date, B: Name, C: Qty, D: Price
                     if (!row[1]) return;
                     transactions.push({
                        date: row[0],
                        type: 'OUT',
                        sku: row[1],
                        qty: parseFloat(row[2]?.replace(/,/g, '') || "0"),
                        price: parseFloat(row[3]?.replace(/,/g, '') || "0"),
                        docRef: row[6] || ""
                    });
                });
            }

            // Sort by Date (Approximation if time missing)
            // Ideally we'd parse DD-MM-YYYY
            return transactions.sort((a, b) => {
                const da = new Date(a.date.split('-').reverse().join('-')); // Assuming DD-MM-YYYY format in sheet? Or standard?
                const db = new Date(b.date.split('-').reverse().join('-'));
                // Attempt standard date parse if above fails or if date format varies
                if (isNaN(da.getTime())) return 0;
                return da.getTime() - db.getTime();
            });

        } catch (error) {
            console.error("Failed to fetch all transactions:", error);
            return [];
        }
    },
    ['all-transactions-history'],
    { revalidate: 300, tags: ['transactions'] }
);

// ============================================================================
// PHASE 9: AUTOMATION RULES (BACKEND)
// ============================================================================

export const RULES_SHEET_NAME = "Config_Rules";
export const RULES_SHEET_HEADERS = ["ID", "Name", "TriggerType", "Condition", "Action", "IsActive", "LastTriggered"];

export async function ensureRulesSheet() {
    await ensureSheetExists(SPREADSHEET_ID, RULES_SHEET_NAME, RULES_SHEET_HEADERS);
}

export interface AutomationRule {
    id: string;
    name: string;
    triggerType: 'STOCK_LEVEL' | 'TRANSACTION' | 'SCHEDULE';
    condition: string; // JSON string
    action: string;    // JSON string
    isActive: boolean;
    lastTriggered?: string;
}

export async function getRules(): Promise<AutomationRule[]> {
    const data = await getSheetData(SPREADSHEET_ID, `'${RULES_SHEET_NAME}'!A:G`);
    if (!data || data.length < 2) return [];

    return data.slice(1).map((row: any[]) => ({
        id: row[0],
        name: row[1],
        triggerType: row[2] as any,
        condition: row[3],
        action: row[4],
        isActive: String(row[5]).toLowerCase() === 'true',
        lastTriggered: row[6]
    }));
}

export async function saveRule(rule: AutomationRule) {
    // Check if exists
    const rules = await getRules();
    const index = rules.findIndex(r => r.id === rule.id);
    
    // Prepare Row
    const row = [
        rule.id,
        rule.name,
        rule.triggerType,
        rule.condition, // JSON
        rule.action,    // JSON
        rule.isActive.toString(),
        rule.lastTriggered || ""
    ];

    if (index === -1) {
        // Create
        await appendSheetRow(SPREADSHEET_ID, `'${RULES_SHEET_NAME}'!A:G`, row);
    } else {
        // Update (Row is index + 2 because header is 1, and array is 0-based)
        const rowNum = index + 2;
        await updateSheetData(SPREADSHEET_ID, `'${RULES_SHEET_NAME}'!A${rowNum}:G${rowNum}`, [row]);
    }
}



// Helper to parse potential Thai dates (DD/MM/YYYY)
function parseDate(dateStr: string): string {
    if (!dateStr) return "";
    
    // Try standard date first
    let d = new Date(dateStr);
    
    // Invalid Date Check
    if (isNaN(d.getTime())) {
        // Try DD/MM/YYYY (common in Thai Sheets)
        const parts = dateStr.trim().split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);
            
            // Handle Thai Year (BE) 2568 -> 2025 (approx, valid > 2400)
            if (year > 2400) year -= 543;

            // Construct strictly as YYYY-MM-DD string to avoid timezone shifts
            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        }
        return ""; // Invalid format
    }

    // IF it was a standard date object (e.g. from YYYY-MM-DD or MM/DD/YYYY),
    // ensure we output YYYY-MM-DD relative to the Local/Client timezone, not UTC.
    // However, if the input is YYYY-MM-DD string, Date() assumes UTC usually.
    // Let's rely on string parsing if possible, or manual extraction.
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Internal fetcher (uncached) - Exported for Data Quality Check
export async function getTransactionsUncached(type: 'IN' | 'OUT', targetSheetId: string = SPREADSHEET_ID) {
    // Legacy Sheet Names often include emojis
    const sheetName = type === 'IN' ? '💸 Transaction รับ' : '💰 Transaction จ่าย';
    console.log(`[getTransactions] Fetching ${type} from sheet: ${sheetName}`);
    
    // Try primary name (with emojis)
    let data = await getSheetData(targetSheetId, `'${sheetName}'!A1:Z2000`);
    
    // Fallback: If failed, try without emojis (clean names)
    if (!data) {
         const cleanName = type === 'IN' ? '💸 Transaction รับ' : '💰 Transaction จ่าย';
         console.log(`[getTransactions] Primary name failed, trying fallback: ${cleanName}`);
         data = await getSheetData(targetSheetId, `'${cleanName}'!A1:Z2000`);
    }

    if (!data || data.length < 2) {
        console.log(`[getTransactions] No data found in ${sheetName} OR clean variant.`);
        return [];
    }

    const headers = data[0];
    const rows = data.slice(1);
    console.log(`[getTransactions] Headers for ${sheetName}:`, headers);
    
    // Improved Mapping
    const idxDate = headers.findIndex(h => h.includes('วันที่'));
    // Find 'ชื่อสินค้า' or 'รายการ'
    const idxName = headers.findIndex(h => h.includes('ชื่อสินค้า') || h.includes('รายการ'));
    // Find 'จำนวน' but NOT 'จำนวนเงิน' (Amount) or 'ราคา'
    // Improved: Robust matching for Quantity
    const idxQty = headers.findIndex(h => {
        const val = h.trim();
        const vLower = val.toLowerCase();
        // Match 'จำนวน', 'Qty', 'Quantity', 'Count'
        // Exclude 'เงิน' (Amount), 'ราคา' (Price), 'บาท' (Baht)
        return (val.includes('จำนวน') || vLower.includes('qty') || vLower.includes('quantity') || vLower.includes('count')) 
            && !val.includes('เงิน')
            && !val.includes('ราคา')
            && !val.includes('ราคา')
            && !val.includes('บาท');
    });

    // Find Price and DocRef
    const idxPrice = headers.findIndex(h => h.includes('ราคา') || h.includes('Price') || h.includes('Amount'));
    const idxDoc = headers.findIndex(h => h.includes('Note') || h.includes('Ref') || h.includes('เอกสาร') || h.includes('อ้างอิง'));

    console.log(`[getTransactions] Indices - Date: ${idxDate}, Name: ${idxName}, Qty: ${idxQty}, Price: ${idxPrice}, Doc: ${idxDoc}`);

    if (idxDate === -1 || idxName === -1 || idxQty === -1) {
        console.error(`[getTransactions] Critical column missing in ${sheetName}`);
        return [];
    }
    
    return rows.map((r, i) => {
        const qtyRaw = r[idxQty];
        const val = parseFloat(qtyRaw?.replace(/,/g, '') || '0');
        // Validation: If no product name, skip
        if (!r[idxName]) return null;
        
        const dateStr = r[idxDate] || "";
        const parsedDate = parseDate(dateStr);
        
        const price = idxPrice > -1 ? parseFloat(r[idxPrice]?.replace(/,/g, '') || '0') : 0;
        const docRef = idxDoc > -1 ? r[idxDoc] : "";

        return {
            date: parsedDate || dateStr,
            product: r[idxName],
            sku: r[idxName],
            qty: val,
            price: price,
            docRef: docRef,
            type: type,
            // Enterprise Fields (Phase 14) - Columns N, O, P = Index 13, 14, 15
            batch: r[13] || "",
            expiryDate: r[14] || "",
            owner: r[15] || ""
        } as Transaction;
    }).filter((t): t is Transaction => t !== null && t.qty !== 0);

}
// Export Cached Version
export const getTransactions = unstable_cache(
    async (type: 'IN' | 'OUT', branchSheetId?: string) => {
        return getTransactionsUncached(type, branchSheetId || SPREADSHEET_ID);
    },
    ['transactions-data'],
    {
        tags: ['transactions'],
        revalidate: 300 // Cache for 5 minutes (History doesn't change fast)
    }
);

export async function getStockMovement(sku: string) {
    console.log(`[getStockMovement] Searching for SKU: "${sku}"`);
    // 1. Fetch All Transactions AND Damage Records
    const [inbound, outbound, damage] = await Promise.all([
        getTransactions('IN'),
        getTransactions('OUT'),
        getDamageRecords()
    ]);

    console.log(`[getStockMovement] Total Inbound Logs: ${inbound.length}`);
    console.log(`[getStockMovement] Total Outbound Logs: ${outbound.length}`);
    console.log(`[getStockMovement] Total Damage Logs: ${damage.length}`);

    // 2. Filter by SKU
    // Normalize SKU for comparison (trim strings)
    const normalizedSku = sku.trim().toLowerCase();
    const productMovs: any[] = [];

    inbound.forEach(t => {
        if (t.product && t.product.toString().trim().toLowerCase() === normalizedSku) {
            productMovs.push({
                date: t.date,
                docRef: 'Inbound', 
                type: 'IN',
                in: t.qty,
                out: 0,
                balance: 0
            });
        }
    });

    outbound.forEach(t => {
        if (t.product && t.product.toString().trim().toLowerCase() === normalizedSku) {
             productMovs.push({
                date: t.date,
                docRef: 'Outbound',
                type: 'OUT',
                in: 0,
                out: t.qty,
                balance: 0
            });
        }
    });

    // Process Damage
    damage.forEach(d => {
        if (d.product_name && d.product_name.toString().trim().toLowerCase() === normalizedSku) {
             productMovs.push({
                date: d.date,
                docRef: `Damage: ${d.reason}`, // Use Reason as Doc Ref
                type: 'DAMAGE',
                in: 0,
                out: d.quantity, // Treat as Out (Reduction)
                balance: 0
            });
        }
    });

    console.log(`[getStockMovement] Found ${productMovs.length} movements for ${sku}`);

    // 3. Sort by Date
    productMovs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 4. Calculate Running Balance
    let runningBalance = 0;
    
    return productMovs.map(m => {
        if (m.type === 'IN') {
            runningBalance += m.in;
        } else if (m.type === 'OUT' || m.type === 'DAMAGE') {
            runningBalance -= m.out;
        }
        return { ...m, balance: runningBalance };
    });
}
export interface POLogItem {
    orderNo: string;    // เลขที่ใบสั่ง (A)
    date: string;       // Date (from transformation)
    customer: string;   // ลูกค้า (B)
    poOrder: string;    // NO. Order (C)
    item: string;       // รายการ (D)
    qty: number;        // จำนวน (E)
    status: string;     // Status (F)
    pdfLink: string;    // PDF Link (G)
    deliveryDate: string; // Date (H)
}


    export async function getPOLogs(): Promise<POLogItem[]> {
        try {
            // Priority 1: PO_SPREADSHEET_ID (Correct Source for Archive/คลังข้อมูล)
            let rawData: any[][] | null = null;
            
            // Try PO ID first
            if (PO_SPREADSHEET_ID) {
                try {
                    console.log(`[getPOLogs] Fetching from PO_SPREADSHEET_ID: ${PO_SPREADSHEET_ID}`);
                    rawData = await getSheetData(PO_SPREADSHEET_ID, "คลังข้อมูล!A:Z");
                } catch (err) {
                    console.warn(`[getPOLogs] Failed to read from PO Sheet ID, trying fallback...`, err);
                }
            }

            // Priority 2: SPREADSHEET_ID (Fallback or if PO ID missing)
            if (!rawData || rawData.length < 2) {
                 if (SPREADSHEET_ID && (SPREADSHEET_ID as string) !== (PO_SPREADSHEET_ID as string)) {
                      try {
                          console.log(`[getPOLogs] Fallback fetching from SPREADSHEET_ID: ${SPREADSHEET_ID}`);
                          rawData = await getSheetData(SPREADSHEET_ID, "คลังข้อมูล!A:Z");
                      } catch (err2) {
                          console.warn(`[getPOLogs] Failed to read from Main Sheet ID`, err2);
                      }
                 }
            }

        if (!rawData || rawData.length < 2) return [];

        const headers = rawData[0];
        const rows = rawData.slice(1);

        // Map by index or name
        const idxOrderNo = headers.findIndex((h: string) => h.includes('เลขที่ใบสั่ง'));
        const idxCustomer = headers.findIndex((h: string) => h.includes('ลูกค้า'));
        const idxPoOrder = headers.findIndex((h: string) => h.includes('NO. Order'));
        const idxItem = headers.findIndex((h: string) => h.includes('รายการ'));
        const idxQty = headers.findIndex((h: string) => h.includes('จำนวน'));
        const idxStatus = headers.findIndex((h: string) => h.includes('Status'));
        const idxPdf = headers.findIndex((h: string) => h.includes('PDF'));
        const idxDate = headers.findIndex((h: string) => h.includes('Date')); // Delivery Date

        return rows.map((r: string[]) => {
             // Logic to derive date from OrderNo (YYYYMMDD-XXX)
             let derivedDate = "";
             const orderNo = r[idxOrderNo] || "";
             if (orderNo.length >= 8 && !isNaN(Number(orderNo.substring(0, 8)))) {
                 const dStr = orderNo.substring(0, 8);
                 derivedDate = `${dStr.substring(0, 4)}-${dStr.substring(4, 6)}-${dStr.substring(6, 8)}`;
             }

             return {
                 orderNo: orderNo,
                 date: derivedDate,
                 customer: r[idxCustomer] || "",
                 poOrder: r[idxPoOrder] || "",
                 item: r[idxItem] || "",
                 qty: parseFloat(r[idxQty]?.replace(/,/g, '') || '0'),
                 status: r[idxStatus] || "Pending",
                 pdfLink: r[idxPdf] || "",
                 deliveryDate: r[idxDate] || ""
             };
        }).filter((i: POLogItem) => i.orderNo)
          .sort((a, b) => b.orderNo.localeCompare(a.orderNo));

    } catch (e) {
        console.error("Error fetching PO Logs:", e);
        return [];
    }
}

// ============================================================================
// USER MANAGEMENT (REAL - USERS SHEET)
// ============================================================================
export interface User {
    id: string;
    username: string;
    role: string;
    status: string;
    lastLogin: string;
}

export async function getUsers(): Promise<User[]> {
    try {
        // Try getting 'Users' sheet. If not exists, might need creation or standard sheet
        const raw = await getSheetData(SPREADSHEET_ID, "'Users'!A:E");
        if (!raw || raw.length < 2) return [];

        return raw.slice(1).map((r, i) => ({
             id: r[0] || `U-${i}`,
             username: r[1] || "Unknown",
             role: r[2] || "User",
             status: r[3] || "Active",
             lastLogin: r[4] || "-"
        }));
    } catch (e) {
        console.error("Fetch Users Error:", e);
        return [];
    }
}

export async function addUser(user: any) {
    const row = [
        `U-${Date.now()}`,
        user.username,
        user.role,
        "Active",
        new Date().toISOString().split('T')[0]
    ];
    await appendSheetRow(SPREADSHEET_ID, "'Users'!A:E", row);
    return true;
}

export async function updateUser(userId: string, data: any) {
    const raw = await getSheetData(SPREADSHEET_ID, "'Users'!A:E");
    if (!raw) return false;
    
    const idx = raw.findIndex(r => r[0] === userId);
    if (idx === -1) return false;
    
    const range = `'Users'!B${idx + 1}:D${idx + 1}`; 
    const values = [[data.username, data.role, data.status]]; 
    
        await updateSheetData(SPREADSHEET_ID, range, values);
        return true;
    }

export async function uploadImageToDrive(fileName: string, folderId: string, imageBase64: string) {
    let drive;
    // 1. Try User OAuth
    const userAuth = getOAuth2Client();
    if (userAuth) {
        drive = google.drive({ version: 'v3', auth: userAuth });
    } else {
        const { drive: saDrive } = await getGoogleDrive();
        drive = saDrive;
    }

    try {
        const fileMetadata = {
            name: fileName,
            parents: [folderId]
        };

        // Handle Base64 (remove prefix data:image/png;base64,)
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);

        const media = {
            mimeType: 'image/png', // Assume PNG for signatures
            body: bufferStream
        };

        const file = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink, webContentLink', 
        });
        
        // Make public (Reader) so fetch() and IMAGE() works
        try {
            await drive.permissions.create({
                fileId: file.data.id!,
                requestBody: {
                    role: 'reader',
                    type: 'anyone',
                },
            });
        } catch (permErr) {
            console.warn("Failed to set public permission on signature:", permErr);
        }
        
        return {
            id: file.data.id,
            link: file.data.webViewLink, // Map to 'link' for consumer
            webViewLink: file.data.webViewLink,
            webContentLink: file.data.webContentLink
        };
    } catch (error) {
        console.error("Error uploading image to Drive:", error);
        throw error;
    }
}

export async function uploadPdfToDrive(pdfBlob: Buffer | ArrayBuffer, fileName: string, folderId: string) {
    let drive;
    const userAuth = getOAuth2Client();
    if (userAuth) {
        drive = google.drive({ version: 'v3', auth: userAuth });
    } else {
        const { drive: saDrive } = await getGoogleDrive();
        drive = saDrive;
    }

    try {
        const fileMetadata = {
            name: fileName,
            parents: [folderId]
        };

        // Convert ArrayBuffer to Buffer if needed
        const buffer = pdfBlob instanceof ArrayBuffer 
            ? Buffer.from(pdfBlob) 
            : pdfBlob;

        const bufferStream = new stream.PassThrough();
        bufferStream.end(buffer);

        const media = {
            mimeType: 'application/pdf',
            body: bufferStream
        };

        const file = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink, webContentLink',
        });

        return {
            id: file.data.id,
            link: file.data.webViewLink,
            webViewLink: file.data.webViewLink,
            webContentLink: file.data.webContentLink
        };
    } catch (error) {
        console.error("Error uploading PDF to Drive:", error);
        throw error;
    }
}
export async function exportSheetToPdf(
    spreadsheetId: string, 
    sheetId: number, 
    fileName: string, 
    folderId: string,
    range: string = 'A1:H20'
) {
     console.log(`[exportSheetToPdf] Generating PDF for ${fileName}...`);
     try {
         // 1. Get Blob
         const blob = await getSheetPdfBlob(spreadsheetId, sheetId, range, false); // Portrait default
         
         // 2. Upload
         const result = await uploadPdfToDrive(blob, fileName, folderId);
         
         return {
             success: true,
             fileId: result.id,
             link: result.webViewLink
         };
     } catch (e: any) {
         console.error("Export PDF Error:", e);
         throw e;
     }
}


export interface DamageRecord {
    rowIndex?: number;
    date: string;
    product_name: string;
    quantity: number;
    unit: string;
    reason: string;
    notes: string;
    reported_by: string;
    status: string;
    approved_by: string;
    approved_date: string;
}

export async function getDamageRecords() {
    // "Damage" Sheet
    const data = await getSheetData(SPREADSHEET_ID, `'Damage'!A1:J1000`);
    if (!data || data.length < 2) return [];

    const rows = data.slice(1);
    // Columns: Date, Name, Qty, Unit, Reason, Notes, Reporter, Status, Approver, ApproveDate
    return rows.map((r, i) => ({
        rowIndex: i + 2, // Header is 1, so data starts at 2
        date: r[0],
        product_name: r[1],
        quantity: parseFloat(r[2]?.replace(/,/g, '') || '0'),
        unit: r[3],
        reason: r[4],
        notes: r[5],
        reported_by: r[6],
        status: r[7] || 'Pending',
        approved_by: r[8],
        approved_date: r[9]
    }));
}

export async function addDamageRecord(data: DamageRecord) {
    // Format: Date, Name, Qty, Unit, Reason, Notes, Reporter, Status, Approver, ApproveDate
    const row = [
        data.date,
        data.product_name,
        data.quantity,
        data.unit,
        data.reason,
        data.notes,
        data.reported_by,
        data.status,
        data.approved_by,
        data.approved_date
    ];
    await appendSheetRow(SPREADSHEET_ID, "'Damage'!A:J", row);
    return true;
}

export async function updateDamageStatusByRow(rowNumber: number, status: string, approver: string) {
    if (rowNumber < 2) return false;

    const date = new Date().toISOString().split('T')[0];
    const range = `'Damage'!H${rowNumber}:J${rowNumber}`; // H=Status, I=Approver, J=Date
    const values = [[status, approver, date]];

    await updateSheetData(SPREADSHEET_ID, range, values);
    return true;
}

export interface CycleCountRecord {
    product_name: string;
    location: string;
    due_date: string;
    count_date: string;
    inspector: string;
    notes: string;
    system_qty: number;
    actual_qty: number;
    variance: number;
    status: string; // Match, Discrepancy
}

export async function getCycleCountLogs() {
    const data = await getSheetData(SPREADSHEET_ID, `'CycleCount_Log'!A1:J1000`);
    if (!data || data.length < 2) return [];

    const rows = data.slice(1);
    return rows.map(r => ({
        product_name: r[0],
        location: r[1],
        due_date: r[2],
        count_date: r[3],
        inspector: r[4],
        notes: r[5],
        system_qty: parseFloat(r[6]?.replace(/,/g, '') || '0'),
        actual_qty: parseFloat(r[7]?.replace(/,/g, '') || '0'),
        variance: parseFloat(r[8]?.replace(/,/g, '') || '0'),
        status: r[9] || 'Unknown'
    }));
}

export async function addCycleCountEntry(data: CycleCountRecord) {
    const row = [
        data.product_name,
        data.location,
        data.due_date,
        data.count_date,
        data.inspector,
        data.notes,
        data.system_qty,
        data.actual_qty,
        data.variance,
        data.status
    ];
    await appendSheetRow(SPREADSHEET_ID, "'CycleCount_Log'!A:J", row);
    return true;
}

export async function getActiveItemsToday(): Promise<string[]> {
    // 1. Get Today's Date in YYYY-MM-DD
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    // Note: Sheet buffer might be day/month swapped or different format, strict comparison might miss.
    // Ideally we check parsing.
    
    // We need to check both IN and OUT transactions
    const [inbound, outbound] = await Promise.all([
        getTransactions('IN'),
        getTransactions('OUT')
    ]);

    const activeSet = new Set<string>();

    // Helper to check if date matches today
    const isToday = (dateStr: string) => {
        if (!dateStr) return false;
        // Check exact match YYYY-MM-DD
        if (dateStr.includes(`${yyyy}-${mm}-${dd}`)) return true;
        
        // Check Thai format DD/MM/YYYY (e.g. 10/01/2569)
        // If we really want to be robust, we parse.
        // But getTransactions() returns parsed "YYYY-MM-DD" in .date if successful.
        return dateStr === `${yyyy}-${mm}-${dd}`;
    };

    inbound.forEach(t => {
        if (!t) return;
        const name = t.product || t.sku;
        if (name && isToday(t.date)) activeSet.add(name);
    });

    outbound.forEach(t => {
        if (!t) return;
        const name = t.product || t.sku;
        if (name && isToday(t.date)) activeSet.add(name);
    });

    return Array.from(activeSet);
}

// ============================================================================
// AUDIT LOG FUNCTIONS (Persistent)
// ============================================================================
export const AUDIT_SHEET_NAME = '12.Audit Logs'; // Named 12.Audit Logs to organize

export interface AuditLogEntry {
    timestamp: string;
    userId: string;
    userName: string;
    action: string;
    module: string;
    recordId: string;
    description: string;
    ipAddress: string;
}

// Internal helper to create a sheet if missing
async function createSheet(spreadsheetId: string, sheetName: string) {
    const { googleSheets, auth } = await getGoogleSheets();
    try {
        await googleSheets.spreadsheets.batchUpdate({
            auth: auth as any,
            spreadsheetId,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: { title: sheetName }
                    }
                }]
            }
        });
        // Add Headers
        const headers = ["Timestamp", "User ID", "User Name", "Action", "Module", "Record ID", "Description", "IP Address"];
        await appendSheetRow(spreadsheetId, `'${sheetName}'!A1:H1`, headers);
        
        console.log(`Created new sheet: ${sheetName}`);
        return true;
    } catch (error: any) {
        // Ignore if already exists (race condition)
        if (error.message?.includes('already exists')) return true;
        console.error("Error creating sheet:", error);
        return false;
    }
}

export async function appendAuditLog(log: AuditLogEntry) {
    try {
        const row = [
            log.timestamp,
            log.userId,
            log.userName,
            log.action,
            log.module,
            log.recordId || '',
            log.description,
            log.ipAddress || ''
        ];
        // Use '12.Audit Logs' sheet
        await appendSheetRow(SPREADSHEET_ID, `'${AUDIT_SHEET_NAME}'!A:H`, row);
    } catch (error: any) {
        // Simple error check: If range not found, try create and retry
        console.warn("Append failed, attempting to create sheet and retry...", error.message);
        const created = await createSheet(SPREADSHEET_ID, AUDIT_SHEET_NAME);
        if (created) {
             const row = [
                log.timestamp,
                log.userId,
                log.userName,
                log.action,
                log.module,
                log.recordId || '',
                log.description,
                log.ipAddress || ''
            ];
            await appendSheetRow(SPREADSHEET_ID, `'${AUDIT_SHEET_NAME}'!A:H`, row);
        }
    }
}

export async function fetchAuditLogsFromSheet() {
    try {
        // Check if sheet exists implicitly by trying to read
        const data = await getSheetData(SPREADSHEET_ID, `'${AUDIT_SHEET_NAME}'!A:H`);
        
        // If data is null/undefined, it might mean sheet doesn't exist or is empty
        if (!data || data.length < 2) return [];

        // Reverse to show newest first
        return data.slice(1).map((row, i) => ({
             id: `log-${Date.now()}-${i}`,
             timestamp: row[0],
             userId: row[1],
             userName: row[2],
             action: row[3],
             module: row[4],
             recordId: row[5],
             description: row[6],
             ipAddress: row[7]
        })).reverse();
    } catch (error) {
        console.error("Failed to fetch audit logs (Sheet likely missing):", error);
        return [];
    }
}

// ============================================================================
// CONFIGURATION & BRANCH MANAGEMENT (Phase 3)
// ============================================================================

export interface BranchConfig {
    id: string;
    name: string;
    spreadsheetId: string;
    color: string;
    status: 'Active' | 'Inactive';
}

export async function getBranchesFromSheet(): Promise<BranchConfig[]> {
    try {
        const sheetName = 'Config_Branches';
        // Ensure sheet exists first
        await ensureSheetExists(USER_SPREADSHEET_ID, sheetName);
        
        const data = await getSheetData(USER_SPREADSHEET_ID, `'${sheetName}'!A1:E100`);
        
        if (!data || data.length < 2) {
            // If empty, return default or empty list
            // We might want to seed logic here if needed
            return [];
        }

        const rows = data.slice(1); // Skip Header
        return rows.map((row: string[]) => ({
            id: row[0] || '',
            name: row[1] || '',
            spreadsheetId: row[2] || '',
            color: row[3] || 'slate',
            status: (row[4] as 'Active' | 'Inactive') || 'Active'
        })).filter((b: BranchConfig) => b.id && b.status === 'Active');

    } catch (error) {
        console.error("Error fetching branches:", error);
        return [];
    }
}

export async function saveBranchToSheet(branch: BranchConfig) {
    const sheetName = 'Config_Branches';
    await ensureSheetExists(USER_SPREADSHEET_ID, sheetName);

    // 1. Get existing data to check for updates vs inserts
    const data = await getSheetData(USER_SPREADSHEET_ID, `'${sheetName}'!A1:E100`);
    
    // Headers if new
    if (!data || data.length === 0) {
        await updateSheetData(USER_SPREADSHEET_ID, `'${sheetName}'!A1:E1`, [['ID', 'Name', 'Spreadsheet ID', 'Color', 'Status']]);
    }

    const rows = data ? data.slice(1) : [];
    const rowIndex = rows.findIndex((r: string[]) => r[0] === branch.id);

    const rowData = [branch.id, branch.name, branch.spreadsheetId, branch.color, branch.status];

    if (rowIndex > -1) {
        // Update existing
        // Row in sheet is rowIndex + 2 (1 for header, 1 for 0-index)
        await updateSheetData(USER_SPREADSHEET_ID, `'${sheetName}'!A${rowIndex + 2}:E${rowIndex + 2}`, [rowData]);
    } else {
        // Append new
        await appendSheetRow(USER_SPREADSHEET_ID, sheetName, rowData);
    }
    
    return true;
}

export async function deleteBranchFromSheet(branchId: string) {
    // Soft Delete: Set Status to 'Inactive'
    const branches = await getBranchesFromSheet();
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return false;

    branch.status = 'Inactive';
    return await saveBranchToSheet(branch);
}



// ============================================================================
// PHASE 12: USER CONFIGURATION (Config_Users)
// ============================================================================


// Helper to ensure a sheet exists
export async function ensureSheetWithHeaders(sheetTitle: string, headers: string[] = []) {
    try {
        const { googleSheets, auth } = await getGoogleSheets();
        
        // 1. Get current sheets
        const meta = await googleSheets.spreadsheets.get({
            auth: auth as any,
            spreadsheetId: SPREADSHEET_ID,
            fields: 'sheets.properties.title'
        });

        const exists = meta.data.sheets?.some(s => s.properties?.title === sheetTitle);

        if (!exists) {
            console.log(`Sheet '${sheetTitle}' missing. Creating...`);
            // 2. Create Sheet
            await googleSheets.spreadsheets.batchUpdate({
                auth: auth as any,
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: { title: sheetTitle }
                        }
                    }]
                }
            });

            // 3. Add Headers if provided
            if (headers.length > 0) {
                await googleSheets.spreadsheets.values.update({
                    auth: auth as any,
                    spreadsheetId: SPREADSHEET_ID,
                    range: `'${sheetTitle}'!A1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [headers]
                    }
                });
            }
            console.log(`Sheet '${sheetTitle}' created successfully.`);
        }
    } catch (error) {
        console.error(`Failed to ensure sheet '${sheetTitle}' exists:`, error);
        // Don't throw, let the subsequent call fail naturally or handle it there
    }
}

export async function getUserConfig(userId: string, key: string): Promise<any> {
    try {
        const rows = await getSheetData(SPREADSHEET_ID, "'Config_Users'!A:C");
        if (!rows || rows.length < 2) return null;

        // Find row matching UserId and Key
        // Row[0] = UserID, Row[1] = Key, Row[2] = Value
        const found = rows.find(r => r[0] === userId && r[1] === key);
        
        if (found && found[2]) {
            try {
                return JSON.parse(found[2]);
            } catch {
                return found[2];
            }
        }
        return null;
    } catch (error) {
        // If sheet doesn't exist, getSheetData might throw. Handle gracefully.
        console.warn(`Failed to get config for ${userId} (Sheet might be missing):`, error);
        return null;
    }
}

export async function saveUserConfig(userId: string, key: string, value: any): Promise<boolean> {
    try {
        const sheetName = 'Config_Users';
        // Ensure sheet exists before saving
        await ensureSheetWithHeaders(sheetName, ['UserID', 'Key', 'Value', 'UpdatedAt']);

        const { googleSheets, auth } = await getGoogleSheets();
        
        // 1. Get all rows to check for existence
        const rows = await getSheetData(SPREADSHEET_ID, `'${sheetName}'!A:C`);
        let rowIndex = -1;

        if (rows && rows.length > 0) {
            rowIndex = rows.findIndex(r => r[0] === userId && r[1] === key);
        }

        const valueStr = JSON.stringify(value);
        const timestamp = new Date().toISOString();

        if (rowIndex !== -1) {
            // 2. Update existing row
            // rowIndex is 0-based index of the array. Sheet rows are 1-based.
            // Since we fetched range A:C, logic assumes A1 is start.
            // If header exists, row 0 is header.
            await googleSheets.spreadsheets.values.update({
                auth: auth as any,
                spreadsheetId: SPREADSHEET_ID,
                range: `'${sheetName}'!C${rowIndex + 1}`, // Update Value column only?
                // Wait, if we fetched A:C, rowIndex + 1 is the actual sheet row number?
                // `getSheetData` usually returns values[][] where index 0 is row 1 (if no offset).
                // Yes.
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[valueStr]]
                }
            });
        } else {
            // 3. Append new row
            await googleSheets.spreadsheets.values.append({
                auth: auth as any,
                spreadsheetId: SPREADSHEET_ID,
                range: `'${sheetName}'!A:C`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [[userId, key, valueStr, timestamp]]
                }
            });
        }
        
        return true;
    } catch (error) {
        console.error(`Failed to save config for ${userId}:`, error);
        return false;
    }
}
