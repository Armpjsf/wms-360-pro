"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUDIT_SHEET_NAME = exports.getTransactions = exports.RULES_SHEET_HEADERS = exports.RULES_SHEET_NAME = exports.getAllTransactions = exports.getProducts = exports.DELIVERY_HISTORY_HEADERS = exports.DELIVERY_HISTORY_SHEET = exports.DELIVERY_FOLDER_ID = exports.PO_SPREADSHEET_ID = exports.USER_SPREADSHEET_ID = exports.getProductSheetName = exports.SPREADSHEET_ID = exports.DOC_SPREADSHEET_ID = exports.PRODUCT_SPREADSHEET_ID = exports.PRODUCT_SHEET_GID = void 0;
exports.getGoogleSheets = getGoogleSheets;
exports.getServiceAccountEmail = getServiceAccountEmail;
exports.getGoogleDrive = getGoogleDrive;
exports.cleanSpreadsheetId = cleanSpreadsheetId;
exports.getSheetId = getSheetId;
exports.getBranchSpreadsheetId = getBranchSpreadsheetId;
exports.resolveSpreadsheetId = resolveSpreadsheetId;
exports.findAllRowIndices = findAllRowIndices;
exports.getSheetPdfBlob = getSheetPdfBlob;
exports.getSheetData = getSheetData;
exports.getSheetFormula = getSheetFormula;
exports.updateSheetData = updateSheetData;
exports.appendSheetRow = appendSheetRow;
exports.appendSheetData = appendSheetData;
exports.clearSheetRange = clearSheetRange;
exports.ensureSheetExists = ensureSheetExists;
exports.getPOLog = getPOLog;
exports.writeRollTagData = writeRollTagData;
exports.ensureDeliveryHistorySheet = ensureDeliveryHistorySheet;
exports.addDeliveryHistory = addDeliveryHistory;
exports.getDeliveryHistory = getDeliveryHistory;
exports.deleteDeliveryHistory = deleteDeliveryHistory;
exports.getProductsUncached = getProductsUncached;
exports.addTransaction = addTransaction;
exports.addProduct = addProduct;
exports.editProduct = editProduct;
exports.ensureRulesSheet = ensureRulesSheet;
exports.getRules = getRules;
exports.saveRule = saveRule;
exports.getTransactionsUncached = getTransactionsUncached;
exports.getStockMovement = getStockMovement;
exports.getPOLogs = getPOLogs;
exports.getUsers = getUsers;
exports.addUser = addUser;
exports.updateUser = updateUser;
exports.uploadImageToDrive = uploadImageToDrive;
exports.uploadPdfToDrive = uploadPdfToDrive;
exports.exportSheetToPdf = exportSheetToPdf;
exports.getDamageRecords = getDamageRecords;
exports.addDamageRecord = addDamageRecord;
exports.updateDamageStatusByRow = updateDamageStatusByRow;
exports.updateDamageHqStatusByRow = updateDamageHqStatusByRow;
exports.getCycleCountLogs = getCycleCountLogs;
exports.addCycleCountEntry = addCycleCountEntry;
exports.getActiveItemsToday = getActiveItemsToday;
exports.appendAuditLog = appendAuditLog;
exports.fetchAuditLogsFromSheet = fetchAuditLogsFromSheet;
exports.getBranchesFromSheet = getBranchesFromSheet;
exports.saveBranchToSheet = saveBranchToSheet;
exports.deleteBranchFromSheet = deleteBranchFromSheet;
exports.ensureSheetWithHeaders = ensureSheetWithHeaders;
exports.getUserConfig = getUserConfig;
exports.saveUserConfig = saveUserConfig;
exports.findSheetTitle = findSheetTitle;
exports.cleanupTempRollTagSheets = cleanupTempRollTagSheets;
exports.clearRollTagForm = clearRollTagForm;
exports.ensureRollTagSheet = ensureRollTagSheet;
const googleapis_1 = require("googleapis");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const stream_1 = __importDefault(require("stream"));
const oauthClient_1 = require("./oauthClient");
const cache_1 = require("next/cache");
// Function to get the Sheets API client
function getGoogleSheets() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let auth;
            // Check if environment variables are available (Vercel deployment)
            if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
                process.env.GOOGLE_PRIVATE_KEY) {
                console.log("Using Google Service Account from environment variables");
                auth = new googleapis_1.google.auth.GoogleAuth({
                    credentials: {
                        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
                    },
                    scopes: [
                        "https://www.googleapis.com/auth/spreadsheets",
                        "https://www.googleapis.com/auth/drive",
                    ],
                });
            }
            else {
                // Fallback to JSON file for local development
                console.log("Using Google Service Account from service-key.json");
                auth = new googleapis_1.google.auth.GoogleAuth({
                    keyFile: path_1.default.join(process.cwd(), "service-key.json"),
                    scopes: [
                        "https://www.googleapis.com/auth/spreadsheets",
                        "https://www.googleapis.com/auth/drive",
                    ],
                });
            }
            const client = yield auth.getClient();
            const googleSheets = googleapis_1.google.sheets({ version: "v4", auth: client });
            return { googleSheets, auth, client };
        }
        catch (error) {
            console.error("Error authenticating to Google Sheets:", error);
            throw error;
        }
    });
}
function getServiceAccountEmail() {
    return __awaiter(this, void 0, void 0, function* () {
        const { auth } = yield getGoogleSheets();
        try {
            const creds = yield auth.getCredentials();
            return creds.client_email || "Unknown Service Account";
        }
        catch (e) {
            console.error("Failed to get service account email:", e);
            return "Unknown Service Account";
        }
    });
}
function getGoogleDrive() {
    return __awaiter(this, void 0, void 0, function* () {
        // 0. PRIORITY: Environment Variable (Serverless/Vercel Support) - User OAuth
        // This allows uploading files as the "User" (who has storage quota) instead of the Service Account (0 bytes).
        const envCredentials = process.env.GOOGLE_CREDENTIALS_JSON;
        const envToken = process.env.GMAIL_TOKEN_JSON; // Re-use the Gmail token which has 'drive' scope
        // Helper to find first existing file
        const findFirst = (paths) => paths.find((p) => fs_1.default.existsSync(p));
        const tokenPath = findFirst([
            path_1.default.join(process.cwd(), "gmail_token.json"),
            path_1.default.join(process.cwd(), "token.json"),
            path_1.default.join(process.cwd(), "..", "gmail_token.json"),
            path_1.default.join(process.cwd(), "..", "token.json"),
        ]) || "";
        const credPath = findFirst([
            path_1.default.join(process.cwd(), "credentials.json"),
            path_1.default.join(process.cwd(), "..", "client_secret.json"),
            path_1.default.join(process.cwd(), "..", "credentials.json"),
        ]) || "";
        // A. Env Var Path
        if (envToken && (credPath || envCredentials)) {
            try {
                console.log("Using User OAuth (Env) for Drive Client");
                let credentials;
                if (envCredentials) {
                    credentials = JSON.parse(envCredentials);
                }
                else {
                    const content = fs_1.default.readFileSync(credPath, "utf-8");
                    credentials = JSON.parse(content);
                }
                const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
                const oAuth2Client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
                const token = JSON.parse(envToken);
                oAuth2Client.setCredentials(token);
                const drive = googleapis_1.google.drive({ version: "v3", auth: oAuth2Client });
                return { drive, auth: oAuth2Client };
            }
            catch (error) {
                console.error("Env Drive Init Failed:", error);
            }
        }
        // B. Legacy File Path (Local Dev)
        if (tokenPath && credPath) {
            try {
                console.log("Using User OAuth (File) for Drive Client");
                const content = fs_1.default.readFileSync(credPath, "utf-8");
                const credentials = JSON.parse(content);
                const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
                const oAuth2Client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
                const token = fs_1.default.readFileSync(tokenPath, "utf-8");
                oAuth2Client.setCredentials(JSON.parse(token));
                const drive = googleapis_1.google.drive({ version: "v3", auth: oAuth2Client });
                return { drive, auth: oAuth2Client };
            }
            catch (error) {
                console.error("File Drive Init Failed:", error);
            }
        }
        // C. Service Account Fallback (Read-Only usually, or 0 Quota)
        console.log("Using Service Account for Drive Client (Fallback)");
        const { auth, client } = yield getGoogleSheets();
        const drive = googleapis_1.google.drive({ version: "v3", auth: client });
        return { drive, auth };
    });
}
function cleanSpreadsheetId(id) {
    if (!id)
        return "";
    // Check if it's a URL
    const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return match[1];
    }
    return id;
}
// CONSTANTS (From User)
exports.PRODUCT_SHEET_GID = 984590829; // Updated from User URL
// SPLIT SPREADSHEET CONFIGURATION
// ID 1: Inventory, Transactions, Damage, Cycle Count, Audit
exports.PRODUCT_SPREADSHEET_ID = cleanSpreadsheetId(process.env.PRODUCT_SPREADSHEET_ID) ||
    "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
// ID 2: Documents, PO Logs, Users, Config, Roll Tags
// ID 2: Documents, PO Logs, Users, Config, Roll Tags -> MIGRATED TO MAIN SHEET (Validation: User confirmed copy)
exports.DOC_SPREADSHEET_ID = exports.PRODUCT_SPREADSHEET_ID; // Was: '1rd...' now consolidated to '1nI...'
// Legacy Fallback (Default to Product ID for core operations if mixed)
exports.SPREADSHEET_ID = exports.PRODUCT_SPREADSHEET_ID;
// Helper to get Sheet Name by GID (Cached)
exports.getProductSheetName = (0, cache_1.unstable_cache)(() => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { googleSheets, auth } = yield getGoogleSheets();
    try {
        // Use the SPREADSHEET_ID exported below (or hardcode if circular dependency issue, but usually fine due to hoisting or module resolution)
        // To be safe, I'll use the ID string directly here to avoid issues if SPREADSHEET_ID is defined lower down.
        const SSID = "1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM";
        const meta = yield googleSheets.spreadsheets.get({
            auth: auth,
            spreadsheetId: SSID,
            fields: "sheets.properties",
        });
        const sheet = (_a = meta.data.sheets) === null || _a === void 0 ? void 0 : _a.find((s) => { var _a; return ((_a = s.properties) === null || _a === void 0 ? void 0 : _a.sheetId) === exports.PRODUCT_SHEET_GID; });
        // Validating against null/undefined title
        if (!((_b = sheet === null || sheet === void 0 ? void 0 : sheet.properties) === null || _b === void 0 ? void 0 : _b.title))
            throw new Error("Product Sheet not found by GID: " + exports.PRODUCT_SHEET_GID);
        return sheet.properties.title;
    }
    catch (error) {
        console.error("Failed to resolve Product Sheet Name:", error);
        throw error;
    }
}), ["product-sheet-name-v2"], // Force refresh with new GID
{ revalidate: 3600 });
// Helper to get Sheet ID (GID) by Name
function getSheetId(spreadsheetId, sheetName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            const response = yield googleSheets.spreadsheets.get({
                auth: auth,
                spreadsheetId,
                fields: "sheets(properties(sheetId,title))",
            });
            const sheet = (_a = response.data.sheets) === null || _a === void 0 ? void 0 : _a.find((s) => { var _a; return ((_a = s.properties) === null || _a === void 0 ? void 0 : _a.title) === sheetName; });
            return ((_b = sheet === null || sheet === void 0 ? void 0 : sheet.properties) === null || _b === void 0 ? void 0 : _b.sheetId) || null;
        }
        catch (error) {
            console.error(`Error getting sheet ID for ${sheetName}:`, error);
            return null;
        }
    });
}
// Helper to resolve Branch Code/ID to Spreadsheet ID (Legacy Parity)
function getBranchSpreadsheetId(branchCode) {
    const mapping = {
        'fmc': exports.PRODUCT_SPREADSHEET_ID,
        'main': exports.PRODUCT_SPREADSHEET_ID,
        'hq': exports.PRODUCT_SPREADSHEET_ID,
    };
    return mapping[branchCode.toLowerCase()] || exports.PRODUCT_SPREADSHEET_ID;
}
// Resolver for Multi-Branch Isolation
function resolveSpreadsheetId(branchId, type) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!branchId || branchId.toLowerCase() === 'hq' || branchId.toLowerCase() === 'main') {
            return cleanSpreadsheetId(type === 'doc' ? exports.DOC_SPREADSHEET_ID : exports.PRODUCT_SPREADSHEET_ID);
        }
        try {
            const branches = yield getBranchesFromSheet();
            const branch = branches.find(b => b.id.toLowerCase() === branchId.toLowerCase());
            if (branch) {
                return cleanSpreadsheetId(type === 'doc' ? branch.spreadsheetId : branch.inventorySpreadsheetId);
            }
        }
        catch (error) {
            console.error("Resolution Error:", error);
        }
        return cleanSpreadsheetId(type === 'doc' ? exports.DOC_SPREADSHEET_ID : exports.PRODUCT_SPREADSHEET_ID);
    });
}
// Find ALL rows matches (for multiple items in one Doc)
function findAllRowIndices(spreadsheetId, sheetName, colIndex, value) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield getSheetData(spreadsheetId, `'${sheetName}'!A:H`);
        const indices = [];
        if (!data)
            return [];
        const targetVal = String(value).trim();
        for (let i = 0; i < data.length; i++) {
            const cellVal = data[i][colIndex] ? String(data[i][colIndex]).trim() : "";
            if (cellVal === targetVal) {
                indices.push(i + 1);
            }
        }
        return indices;
    });
}
function getSheetPdfBlob(spreadsheetId_1, sheetId_1) {
    return __awaiter(this, arguments, void 0, function* (spreadsheetId, sheetId, range = "A1:H20", landscape = true, scale = 2, margin = 0.75, align = "", valign = "") {
        var _a, _b, _c, _d;
        const { auth } = yield getGoogleSheets();
        const token = yield auth.getAccessToken();
        // Parse human range (e.g. "A1:E18" or "SheetName!A1:E18") into Google Sheets PDF export grid indices.
        // This is required because Google's PDF export engine ignores the text '&range=A1:E18' parameter
        // and instead requires 'r1', 'r2', 'c1', 'c2' grid indexing parameters to crop.
        let gridParams = "";
        if (range) {
            const cleanRange = range.includes("!") ? range.split("!")[1] : range;
            const parts = cleanRange.split(":");
            if (parts.length === 2) {
                const start = parts[0];
                const end = parts[1];
                const startColLetter = ((_a = start.match(/[A-Z]+/)) === null || _a === void 0 ? void 0 : _a[0]) || "A";
                const startRowStr = ((_b = start.match(/\d+/)) === null || _b === void 0 ? void 0 : _b[0]) || "1";
                const endColLetter = ((_c = end.match(/[A-Z]+/)) === null || _c === void 0 ? void 0 : _c[0]) || "E";
                const endRowStr = ((_d = end.match(/\d+/)) === null || _d === void 0 ? void 0 : _d[0]) || "18";
                const colToIndex = (letter) => {
                    let index = 0;
                    for (let i = 0; i < letter.length; i++) {
                        index = index * 26 + (letter.charCodeAt(i) - 64);
                    }
                    return index - 1;
                };
                const c1 = colToIndex(startColLetter);
                const r1 = parseInt(startRowStr) - 1;
                const c2 = colToIndex(endColLetter) + 1; // exclusive limit
                const r2 = parseInt(endRowStr); // exclusive limit
                gridParams = `&r1=${r1}&r2=${r2}&c1=${c1}&c2=${c2}&ir=false&ic=false`;
            }
        }
        // Alignment query strings (only applied if explicitly requested, e.g. for Roll Tags)
        let alignParams = "";
        if (align)
            alignParams += `&align=${align}`;
        if (valign)
            alignParams += `&valign=${valign}`;
        // Use custom scale and margin if provided, otherwise fallback to perfect defaults (scale=2, margin=0.75)
        const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=pdf` +
            `&gid=${sheetId}` +
            `&size=a4` +
            `&portrait=${!landscape}` +
            `&scale=${scale}` +
            `&gridlines=false` +
            `&printtitle=false` +
            `&sheetnames=false` +
            `&top_margin=${margin}&bottom_margin=${margin}&left_margin=${margin}&right_margin=${margin}` +
            alignParams +
            gridParams;
        console.log(`[PDF Export] URL: ${url.slice(0, 150)}...`);
        const res = yield fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
            // Enhanced error logging
            const errorBody = yield res.text();
            console.error(`[PDF Export] Failed! Status: ${res.status}, Body: ${errorBody.slice(0, 500)}`);
            throw new Error(`PDF Export Failed: ${res.statusText}`);
        }
        return yield res.arrayBuffer();
    });
}
// Legacy export function (kept for reference or backward compatibility if needed, but we are replacing it for pure blob fetch)
// We'll leave the old 'exportSheetToPdf' signature commented out or removed if unused.
// Replaced by getSheetPdfBlob for direct streaming.
// Helper to get all values from a spreadsheet
function getSheetData(spreadsheetId, range) {
    return __awaiter(this, void 0, void 0, function* () {
        const { googleSheets, auth } = yield getGoogleSheets();
        // Don't try-catch here; let errors bubble up so unstable_cache knows it failed
        // and doesn't cache an empty result.
        const response = yield googleSheets.spreadsheets.values.get({
            auth: auth,
            spreadsheetId,
            range,
        });
        return response.data.values || [];
    });
}
// Helper to get raw formulas from a spreadsheet
function getSheetFormula(spreadsheetId, range) {
    return __awaiter(this, void 0, void 0, function* () {
        // Force rebuild
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            const response = yield googleSheets.spreadsheets.values.get({
                auth: auth,
                spreadsheetId,
                range,
                valueRenderOption: "FORMULA", // Get Raw Formula
            });
            return response.data.values || [];
        }
        catch (error) {
            console.error(`Error reading sheet formulas ${range}:`, error);
            return [];
        }
    });
}
// Helper to update values in a spreadsheet
function updateSheetData(spreadsheetId, range, values) {
    return __awaiter(this, void 0, void 0, function* () {
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            yield googleSheets.spreadsheets.values.update({
                auth: auth,
                spreadsheetId,
                range,
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    values: values,
                },
            });
            // Invalidate cache for relevant tags
            // @ts-ignore
            (0, cache_1.revalidateTag)("products");
            // @ts-ignore
            (0, cache_1.revalidateTag)("transactions");
            // @ts-ignore
            (0, cache_1.revalidateTag)("dashboard"); // Ensure dashboard updates too
        }
        catch (error) {
            console.error(`Error updating sheet range ${range}:`, error);
            throw error;
        }
    });
}
// Helper to append values to a spreadsheet
function appendSheetRow(spreadsheetId, range, rowData) {
    return __awaiter(this, void 0, void 0, function* () {
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            yield googleSheets.spreadsheets.values.append({
                auth: auth,
                spreadsheetId,
                range,
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    values: [rowData],
                },
            });
            // Invalidate cache immediately
            // @ts-ignore
            (0, cache_1.revalidateTag)("products");
            // @ts-ignore
            (0, cache_1.revalidateTag)("transactions");
            // @ts-ignore
            (0, cache_1.revalidateTag)("dashboard");
        }
        catch (error) {
            console.error(`Error appending to sheet ${range}:`, error);
            throw error;
        }
    });
}
function appendSheetData(spreadsheetId, range, values) {
    return __awaiter(this, void 0, void 0, function* () {
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            yield googleSheets.spreadsheets.values.append({
                auth: auth,
                spreadsheetId,
                range,
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    values: values,
                },
            });
            // Invalidate cache immediately
            // @ts-ignore
            (0, cache_1.revalidateTag)("products");
            // @ts-ignore
            (0, cache_1.revalidateTag)("transactions");
            // @ts-ignore
            (0, cache_1.revalidateTag)("dashboard");
        }
        catch (error) {
            console.error(`Error appending batch to sheet ${range}:`, error);
            throw error;
        }
    });
}
// Helper to clear values in a range
function clearSheetRange(spreadsheetId, range) {
    return __awaiter(this, void 0, void 0, function* () {
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            yield googleSheets.spreadsheets.values.clear({
                auth: auth,
                spreadsheetId,
                range,
            });
        }
        catch (error) {
            console.error(`Error clearing sheet range ${range}:`, error);
            throw error;
        }
    });
}
// Helper to ensure a sheet exists, creating it if necessary
function ensureSheetExists(spreadsheetId_1, sheetName_1) {
    return __awaiter(this, arguments, void 0, function* (spreadsheetId, sheetName, headers = []) {
        const { googleSheets, auth } = yield getGoogleSheets();
        // 1. Check if exists
        const sheetId = yield getSheetId(spreadsheetId, sheetName);
        if (sheetId !== null)
            return; // Exists
        console.log(`[GoogleSheets] Sheet '${sheetName}' missing. Creating...`);
        try {
            // 2. Create Sheet
            yield googleSheets.spreadsheets.batchUpdate({
                auth: auth,
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: { title: sheetName },
                            },
                        },
                    ],
                },
            });
            // 3. Add Headers if provided
            if (headers.length > 0) {
                yield googleSheets.spreadsheets.values.update({
                    auth: auth,
                    spreadsheetId,
                    range: `${sheetName}!A1`,
                    valueInputOption: "USER_ENTERED",
                    requestBody: {
                        values: [headers],
                    },
                });
            }
            console.log(`[GoogleSheets] Sheet '${sheetName}' created successfully.`);
        }
        catch (error) {
            console.error(`Error creating sheet '${sheetName}':`, error);
            // Don't throw, let the subsequent append fail with a native error if this failed,
            // or throw to stop early. Better to throw to inform API.
            throw new Error(`Failed to create sheet '${sheetName}': ${error.message}`);
        }
    });
}
function getPOLog() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const SPREADSHEET_ID = exports.DOC_SPREADSHEET_ID ||
                cleanSpreadsheetId(process.env.NEXT_PUBLIC_PO_SPREADSHEET_ID);
            if (!SPREADSHEET_ID) {
                console.error("SPREADSHEET_ID not configured");
                return [];
            }
            let rawData = null;
            try {
                rawData = yield getSheetData(SPREADSHEET_ID, "คลังข้อมูล!A:I");
            }
            catch (err) {
                console.error("Error reading คลังข้อมูล sheet:", err);
                return [];
            }
            if (!rawData || rawData.length === 0)
                return [];
            const entries = [];
            for (let i = 0; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length < 5)
                    continue;
                const date = row[0] || "";
                const po = row[1] || "";
                const supplier = row[2] || "";
                const itemsRaw = row[3] || "";
                const totalRaw = row[4] || "";
                const status = row[5] || "Pending";
                const notes = row[6] || "";
                const receivedDate = row[7] || "";
                const receivedBy = row[8] || "";
                if (!po)
                    continue;
                let items = [];
                try {
                    items = JSON.parse(itemsRaw);
                }
                catch (_a) {
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
                    received_by: receivedBy,
                });
            }
            return entries;
        }
        catch (error) {
            console.error("Error in getPOLog:", error);
            return [];
        }
    });
}
function writeRollTagData(spreadsheetId, sheetName, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            // 1. Prepare Data
            const customerId = data.customerId;
            const items = data.items;
            const MAX_ROWS = 9;
            const ordersForForm = [];
            const itemsForForm = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const qtyForForm = [];
            const formulasForForm = [];
            let lastOrderNoWritten = "";
            for (let i = 0; i < MAX_ROWS; i++) {
                // Formula for C column: =IFERROR(VLOOKUP(B{Row}, Items!A:B, 2, FALSE), "")
                const rowNum = 9 + i;
                formulasForForm.push([
                    `=IFERROR(VLOOKUP(B${rowNum}, Items!A:B, 2, FALSE), "")`,
                ]);
                if (i < items.length) {
                    const item = items[i];
                    const currentOrder = item.orderNo;
                    if (currentOrder && currentOrder === lastOrderNoWritten) {
                        ordersForForm.push([""]);
                    }
                    else {
                        ordersForForm.push([currentOrder]);
                        lastOrderNoWritten = currentOrder;
                    }
                    itemsForForm.push([item.itemCode]);
                    qtyForForm.push([item.quantity]);
                }
                else {
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
                { range: `${sheetName}!E9:E17`, values: qtyForForm },
            ];
            // We also want to clear D9:D17 (Legacy clears D9:E17, writes E9:E17).
            // So effectively D9:D17 is cleared.
            const emptyCol = Array(9).fill([""]);
            updates.push({ range: `${sheetName}!D9:D17`, values: emptyCol });
            yield googleSheets.spreadsheets.values.batchUpdate({
                auth: auth,
                spreadsheetId,
                requestBody: {
                    valueInputOption: "USER_ENTERED",
                    data: updates,
                },
            });
            console.log(`Successfully wrote to ${sheetName} for Customer ${customerId}`);
            return true;
        }
        catch (error) {
            console.error(`Error writing Roll Tag to ${sheetName}:`, error);
            throw error;
        }
    });
}
// ⚠️ IMPORTANT: Spreadsheet IDs Configuration ⚠️
// 1. Main Inventory & Transactions (Original Data)
// 1. Data Source Configured at Top of File
// export const SPREADSHEET_ID = ... (Removed duplicate)
// export const INVENTORY_SPREADSHEET_ID = ... (Removed duplicate)
// 2. User Management (New Sheet)
// ID 3: Users (Authentication) -> MIGRATED TO MAIN SHEET
exports.USER_SPREADSHEET_ID = exports.PRODUCT_SPREADSHEET_ID; // Was: "1rd..." now consolidated
// 3. PO Logs (Check which sheet contains 'คลังข้อมูล')
// If uncertain, we often check both in getPOLogs, but let's default to Main if that's where it was.
// The comment previously linked it to the NEW ID, but let's be careful.
// If 'คลังข้อมูล' was in the original sheet, use SPREADSHEET_ID.
exports.PO_SPREADSHEET_ID = exports.DOC_SPREADSHEET_ID; // The "Form Link Mail" sheet contains "คลังข้อมูล"
exports.DELIVERY_FOLDER_ID = "1QGOYQUX8eDxmzuZ6pbiXJH5iuKAZG8s3"; // Folder for Delivery PDFs
exports.DELIVERY_HISTORY_SHEET = "ประวัติงานส่ง";
exports.DELIVERY_HISTORY_HEADERS = [
    "วันที่",
    "ชื่อลูกค้า",
    "จัดส่งไปที่",
    "Order",
    "SKU",
    "จำนวนของ",
    "จำนวนแพ็ก",
    "ค่าขนส่ง",
    "หมายเหตุ",
    "ลิงก์เอกสาร"
];
function ensureDeliveryHistorySheet(spreadsheetId) {
    return __awaiter(this, void 0, void 0, function* () {
        const SSID = spreadsheetId || exports.PRODUCT_SPREADSHEET_ID;
        yield ensureSheetExists(SSID, exports.DELIVERY_HISTORY_SHEET, exports.DELIVERY_HISTORY_HEADERS);
    });
}
function addDeliveryHistory(rows, spreadsheetId) {
    return __awaiter(this, void 0, void 0, function* () {
        const SSID = spreadsheetId || exports.PRODUCT_SPREADSHEET_ID;
        yield ensureDeliveryHistorySheet(SSID);
        // Ensure we append to A:J (10 columns)
        yield appendSheetData(SSID, `'${exports.DELIVERY_HISTORY_SHEET}'!A:J`, rows);
    });
}
function getDeliveryHistory(spreadsheetId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const SSID = spreadsheetId || exports.PRODUCT_SPREADSHEET_ID;
            const rawData = yield getSheetData(SSID, `'${exports.DELIVERY_HISTORY_SHEET}'!A:J`);
            if (!rawData || rawData.length < 2)
                return [];
            const headers = rawData[0];
            const rows = rawData.slice(1);
            return rows.map((r) => ({
                date: r[0] || "",
                customer: r[1] || "",
                location: r[2] || "",
                orderNo: r[3] || "",
                sku: r[4] || "",
                qty: parseFloat(String(r[5] || "0").replace(/,/g, "")) || 0,
                packs: parseFloat(String(r[6] || "0").replace(/,/g, "")) || 0,
                shippingCost: parseFloat(String(r[7] || "0").replace(/,/g, "")) || 0,
                notes: r[8] || "",
                pdfLink: r[9] || ""
            })).reverse(); // Newest first
        }
        catch (error) {
            console.error("Error fetching delivery history:", error);
            return [];
        }
    });
}
function deleteDeliveryHistory(date, customer, orderNo, sku, spreadsheetId) {
    return __awaiter(this, void 0, void 0, function* () {
        const SSID = spreadsheetId || exports.PRODUCT_SPREADSHEET_ID;
        const { googleSheets, auth } = yield getGoogleSheets();
        // 1. Fetch data to find row index
        const rawData = yield getSheetData(SSID, `'${exports.DELIVERY_HISTORY_SHEET}'!A:E`);
        if (!rawData || rawData.length < 2)
            return false;
        // Search for exact match
        let rowIndexToDelete = -1;
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (row[0] === date && row[1] === customer && row[3] === orderNo && row[4] === sku) {
                rowIndexToDelete = i;
                break;
            }
        }
        if (rowIndexToDelete === -1) {
            console.warn(`[DeleteHistory] No matching row found for ${customer} / ${orderNo}`);
            return false;
        }
        // 2. Get Sheet ID
        const sheetId = yield getSheetId(SSID, exports.DELIVERY_HISTORY_SHEET);
        if (sheetId === null)
            return false;
        // 3. Delete Dimension (Delete the row)
        yield googleSheets.spreadsheets.batchUpdate({
            auth: auth,
            spreadsheetId: SSID,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: "ROWS",
                                startIndex: rowIndexToDelete,
                                endIndex: rowIndexToDelete + 1
                            }
                        }
                    }
                ]
            }
        });
        return true;
    });
}
// ============================================================================
// CORE DATA FUNCTIONS (REAL)
// ============================================================================
const ownerFilter_1 = require("./ownerFilter");
// Internal fetcher (uncached) - Exported for Data Quality Check
function getProductsUncached() {
    return __awaiter(this, arguments, void 0, function* (targetSheetId = exports.PRODUCT_SPREADSHEET_ID, allowedOwners) {
        // 1. Try Dynamic Resolution via GID (Most Robust)
        let rawData;
        try {
            const dynamicSheetName = yield (0, exports.getProductSheetName)(); // Resolves via GID
            if (dynamicSheetName) {
                rawData = yield getSheetData(targetSheetId, `'${dynamicSheetName}'!A1:Z2000`);
            }
        }
        catch (e) {
            console.warn("Dynamic sheet name resolution failed:", e);
        }
        // 2. Fallback: Try '📊 รายงานสินค้าคงเหลือ' (Hardcoded User Preference)
        if (!rawData || rawData.length < 2) {
            try {
                rawData = yield getSheetData(targetSheetId, "'📊 รายงานสินค้าคงเหลือ'!A1:Z1000");
            }
            catch (e) {
                console.warn("Primary hardcoded sheet '📊 รายงานสินค้าคงเหลือ' not found, attempting next fallback...", e);
            }
        }
        // 3. Fallback: Try 'ชื่อสินค้า' (Legacy Default)
        if (!rawData || rawData.length < 2) {
            console.log("Primary strategies failed, trying 'ชื่อสินค้า'...");
            try {
                rawData = yield getSheetData(targetSheetId, "'ชื่อสินค้า'!A1:Z1000");
            }
            catch (e) {
                console.warn("Fallback sheet 'ชื่อสินค้า' not found.", e);
            }
        }
        // [Phase A] Optimization: Fetch Transactions for Auto-Movement Calculation - REMOVED per user request
        // 4. Trace why we might return empty
        if (!rawData || rawData.length < 2) {
            console.warn("getProductsUncached: No data found in any fallback strategy.");
            return [];
        }
        const headers = rawData[0].map((h) => h.trim());
        const rows = rawData.slice(1);
        console.log(`[getProductsUncached] Resolved Data from GID/Name. Rows: ${rows.length}. Headers: ${headers.join(', ')}`);
        // Map Header Columns (Legacy Compatibility)
        const getColIndex = (keywords) => headers.findIndex((h) => {
            const headerVal = h.trim();
            return keywords.some((k) => headerVal === k || headerVal.includes(k));
        });
        const idxName = getColIndex(["ชื่อสินค้า", "product_name", "item_name"]);
        const idxCat = getColIndex(["กลุ่มสินค้า", "category", "group"]);
        const idxPrice = getColIndex(["ราคามาตรฐาน", "ราคา", "price", "cost", "ต้นทุนเฉลี่ยต่อชิ้น", "ต้นทุน"]);
        const idxStock = getColIndex([
            "จำนวนสินค้าคงเหลือ",
            "จำนวนคงเหลือ",
            "คงเหลือ",
            "Stock",
            "Balance",
            "จำนวน",
        ]);
        const idxUnit = getColIndex(["หน่วยนับ", "unit"]);
        const idxImgLink = getColIndex(["ลิงค์", "link", "drive", "url"]);
        const idxImgNormal = getColIndex(["รูป", "image", "picture", "photo"]);
        const idxStatus = getColIndex([
            "Status",
            "status",
            "สถานะ",
            "สถานะการเติมสินค้า",
            "สถานะสินค้า",
        ]);
        const idxMin = getColIndex(["จำนวนขั้นต่ำ", "min", "safety_stock"]);
        let idxLocation = getColIndex([
            "Location",
            "location",
            "ที่เก็บ",
            "ตำแหน่ง",
            "Shelf",
            "shelf",
            "Zone",
            "zone",
        ]);
        const idxOwner = getColIndex([
            "Owner",
            "owner",
            "เจ้าของ",
            "Customer",
            "customer",
            "Client",
        ]);
        const idxMovement = getColIndex([
            "Movement",
            "movement",
            "Turnover",
            "turnover",
            "การเคลื่อนไหว",
            "สถานะการเคลื่อนไหว",
            "ประเภทการเคลื่อนไหวสินค้า",
        ]);
        console.log(`[getProductsUncached] Column Indices - Name: ${idxName}, Movement: ${idxMovement}, Owner: ${idxOwner}, Stock: ${idxStock}`);
        if (idxLocation === -1) {
            // console.log("Location header not found, defaulting to Column Q");
            idxLocation = 16;
        }
        if (idxName === -1) {
            // Critical: Do NOT return empty array, as this will be cached.
            // Throwing error allows Next.js to serve stale cache (if available) or retry.
            throw new Error(`Product Name column not found in Sheet. Headers detected: ${headers.join(", ")}`);
        }
        const products = rows
            .map((row, i) => {
            var _a, _b, _c;
            if (!row[idxName])
                return null; // Skip empty names
            // Resolve Image
            let imgVal = idxImgLink > -1 && row[idxImgLink]
                ? row[idxImgLink]
                : idxImgNormal > -1 && row[idxImgNormal]
                    ? row[idxImgNormal]
                    : "";
            if (imgVal && imgVal.includes("drive.google.com")) {
                const driveMatch = imgVal.match(/\/d\/([a-zA-Z0-9_-]+)/);
                const idMatch = imgVal.match(/id=([a-zA-Z0-9_-]+)/);
                if (driveMatch && driveMatch[1])
                    imgVal = `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
                else if (idMatch && idMatch[1])
                    imgVal = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
            }
            return {
                id: `P-${i + 1}`,
                name: row[idxName] || "Unknown",
                category: idxCat > -1 ? row[idxCat] : "General",
                stock: idxStock > -1
                    ? parseFloat(((_a = row[idxStock]) === null || _a === void 0 ? void 0 : _a.replace(/,/g, "")) || "0")
                    : 0,
                price: idxPrice > -1
                    ? parseFloat(((_b = row[idxPrice]) === null || _b === void 0 ? void 0 : _b.replace(/,/g, "")) || "0")
                    : 0,
                unit: idxUnit > -1 ? row[idxUnit] : "pcs",
                image: (() => {
                    let imgVal = idxImgLink > -1 && row[idxImgLink]
                        ? row[idxImgLink]
                        : idxImgNormal > -1 && row[idxImgNormal]
                            ? row[idxImgNormal]
                            : "";
                    if (imgVal && imgVal.includes("drive.google.com")) {
                        const driveMatch = imgVal.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        const idMatch = imgVal.match(/id=([a-zA-Z0-9_-]+)/);
                        if (driveMatch && driveMatch[1])
                            imgVal = `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
                        else if (idMatch && idMatch[1])
                            imgVal = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
                    }
                    return imgVal;
                })(),
                status: idxStatus > -1 ? row[idxStatus] : "Active",
                minStock: idxMin > -1 ? parseFloat(((_c = row[idxMin]) === null || _c === void 0 ? void 0 : _c.replace(/,/g, "")) || "0") : 0,
                location: idxLocation > -1 ? row[idxLocation] : "-",
                owner: idxOwner > -1 ? row[idxOwner] : "", // Map Owner
                movementStatus: idxMovement > -1 ? (row[idxMovement] || "").trim() : "",
            };
        })
            .filter((p) => p !== null);
        console.log(`[getProductsUncached] Parsed ${products.length} products. First item:`, products[0]);
        // Apply Owner Filter
        return (0, ownerFilter_1.filterByOwner)(products, allowedOwners);
    });
}
// -------------------------------------------------------------
// CACHED WRAPPER (Now supports Branch ID + Owner)
// -------------------------------------------------------------// Export Cached Version
exports.getProducts = (0, cache_1.unstable_cache)((branchSheetId, allowedOwners) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("[getProducts] Fetching Data (Sheet Mode)...");
    const products = yield getProductsUncached(branchSheetId, allowedOwners);
    return products;
}), ['products-data-sheet-only-v3'], // Cache Key Updated
{ revalidate: 300, tags: ['products-sheet-only-v3'] } // Cache Tag Updated
);
function resolveTransactionSheetName(type) {
    return __awaiter(this, void 0, void 0, function* () {
        const emojiName = type === "IN" ? "💸 Transaction รับ" : "💰 Transaction จ่าย";
        const cleanName = type === "IN" ? "Transaction รับ" : "Transaction จ่าย";
        // Check Emoji First (Lightweight check)
        // Uses PRODUCT_SPREADSHEET_ID because Transactions are in Sheet ID 1
        const test = yield getSheetData(exports.PRODUCT_SPREADSHEET_ID, `'${emojiName}'!A1`);
        if (test !== null)
            return emojiName; // Exists
        return cleanName; // Fallback
    });
}
function addTransaction(type, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const sheetName = yield resolveTransactionSheetName(type);
        // Invalidate cache immediately on write
        // @ts-ignore
        (0, cache_1.revalidateTag)("transactions");
        // @ts-ignore
        (0, cache_1.revalidateTag)("products");
        // @ts-ignore
        (0, cache_1.revalidateTag)("dashboard");
        // Find next row for formula references
        const existingData = yield getSheetData(exports.SPREADSHEET_ID, `'${sheetName}'!A:A`);
        const rowNum = ((existingData === null || existingData === void 0 ? void 0 : existingData.length) || 0) + 1;
        // Format date: DD/MM/YYYY Buddhist Era (Thai format)
        const now = new Date();
        const utc = now.getTime() + now.getTimezoneOffset() * 60000;
        const bangkokOffset = 7 * 60 * 60 * 1000;
        const thDate = new Date(utc + bangkokOffset);
        const dateStr = data.date ||
            `${thDate.getDate()}/${thDate.getMonth() + 1}/${thDate.getFullYear() + 543}`;
        let row;
        let range;
        if (type === "OUT") {
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
                dateStr, // A: วันที่
                data.sku, // B: ชื่อสินค้า
                data.qty, // C: จำนวน
                data.price || 0, // D: ราคา
                data.unit || "แผ่น", // E: หน่วยนับ
                formulaF, // F: มูลค่ารวม
                formulaG, // G: ต้นทุนเฉลี่ยรวม
                formulaH, // H: กำไรขั้นต้น
                formulaI, // I: %กำไรขั้นต้น
                formulaJ, // J: กลุ่มสินค้า
                formulaK, // K: หมายเหตุ
                data.docRef || "", // L: Order/DocRef
            ];
            range = `'${sheetName}'!A${rowNum}:L${rowNum}`;
        }
        else {
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
                    const productData = yield getSheetData(exports.SPREADSHEET_ID, "'ชื่อสินค้า'!B:C");
                    if (productData) {
                        const found = productData.find((row) => row[0] === data.sku);
                        if (found && found[1]) {
                            costPrice = parseFloat(String(found[1]).replace(/,/g, "")) || 0;
                        }
                    }
                }
                catch (e) {
                    console.error("[addTransaction] Cost lookup failed:", e);
                    costPrice = 0;
                }
            }
            const formulaF = `=IF(LEN(INDIRECT("B"&ROW()))>0, INDIRECT("C"&ROW()) * INDIRECT("D"&ROW()), "")`;
            row = [
                dateStr, // A: วันที่
                data.sku, // B: ชื่อสินค้า
                data.qty, // C: จำนวนที่ซื้อ
                costPrice || 0, // D: ราคา (from ชื่อสินค้า!C)
                data.unit || "แผ่น", // E: หน่วยนับ
                formulaF, // F: มูลค่ารวม (Formula)
                data.docRef || data.location || "", // G: หมายเหตุ (location)
            ];
            range = `'${sheetName}'!A${rowNum}:G${rowNum}`;
        }
        // Use updateSheetData to write formulas correctly
        yield updateSheetData(exports.SPREADSHEET_ID, range, [row]);
        return true;
    });
}
function addProduct(data, spreadsheetId) {
    return __awaiter(this, void 0, void 0, function* () {
        const SSID = spreadsheetId || exports.SPREADSHEET_ID;
        const sheetName = yield (0, exports.getProductSheetName)();
        console.log(`[addProduct] Resolved Sheet Name: ${sheetName}`);
        if (!sheetName)
            throw new Error("Could not resolve Product Sheet Name");
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
            data.location || "-", // A
            data.name, // B
            data.cost || 0, // C
            data.price || 0, // D
            data.unit || "ชิ้น", // E
            data.minStock || 0, // F
            data.category || "General", // G
            "Active", // H
            data.image || "", // I
            "", // J (Drive Link - usually empty if direct link used)
        ];
        yield appendSheetRow(SSID, `'${sheetName}'!A:J`, row);
        return true;
    });
}
function editProduct(oldName, updates, spreadsheetId) {
    return __awaiter(this, void 0, void 0, function* () {
        const SSID = spreadsheetId || exports.SPREADSHEET_ID;
        const sheetName = yield (0, exports.getProductSheetName)();
        if (!sheetName)
            return false;
        try {
            const products = yield (0, exports.getProducts)(SSID);
            const index = products.findIndex((p) => p.name === oldName);
            if (index === -1)
                return false;
            const rowNum = index + 2;
            const row = [
                updates.location || products[index].location || "-", // A
                updates.name || products[index].name, // B
                updates.cost || 0, // C
                updates.price || products[index].price, // D
                updates.unit || products[index].unit, // E
                updates.minStock || products[index].minStock, // F
                updates.category || products[index].category, // G
                updates.status || products[index].status, // H
                updates.image || products[index].image, // I
                "", // J (Link)
            ];
            yield updateSheetData(SSID, `'${sheetName}'!A${rowNum}:J${rowNum}`, [row]);
            (0, cache_1.revalidateTag)("products-sheet-only-v3");
            return true;
        }
        catch (error) {
            console.error("Edit Product Error:", error);
            return false;
        }
    });
}
// Cached fetcher for Transaction History
exports.getAllTransactions = (0, cache_1.unstable_cache)(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Fetch Trans In & Trans Out parallel
        const [inData, outData] = yield Promise.all([
            getSheetData(exports.SPREADSHEET_ID, "'💸 Transaction รับ'!A:G"),
            getSheetData(exports.SPREADSHEET_ID, "'💰 Transaction จ่าย'!A:G"),
        ]);
        const transactions = [];
        // Parse IN (Skip Header)
        if (inData && inData.length > 1) {
            inData.slice(1).forEach((row) => {
                var _a, _b;
                // A: Date, B: Name, C: Qty, D: Price
                if (!row[1])
                    return;
                transactions.push({
                    date: row[0],
                    type: "IN",
                    sku: row[1],
                    qty: parseFloat(((_a = row[2]) === null || _a === void 0 ? void 0 : _a.replace(/,/g, "")) || "0"),
                    price: parseFloat(((_b = row[3]) === null || _b === void 0 ? void 0 : _b.replace(/,/g, "")) || "0"),
                    docRef: row[6] || "",
                });
            });
        }
        // Parse OUT (Skip Header)
        if (outData && outData.length > 1) {
            outData.slice(1).forEach((row) => {
                var _a, _b;
                // A: Date, B: Name, C: Qty, D: Price
                if (!row[1])
                    return;
                transactions.push({
                    date: row[0],
                    type: "OUT",
                    sku: row[1],
                    qty: parseFloat(((_a = row[2]) === null || _a === void 0 ? void 0 : _a.replace(/,/g, "")) || "0"),
                    price: parseFloat(((_b = row[3]) === null || _b === void 0 ? void 0 : _b.replace(/,/g, "")) || "0"),
                    docRef: row[6] || "",
                });
            });
        }
        // Sort by Date (Approximation if time missing)
        // Ideally we'd parse DD-MM-YYYY
        return transactions.sort((a, b) => {
            const da = new Date(a.date.split("-").reverse().join("-")); // Assuming DD-MM-YYYY format in sheet? Or standard?
            const db = new Date(b.date.split("-").reverse().join("-"));
            // Attempt standard date parse if above fails or if date format varies
            if (isNaN(da.getTime()))
                return 0;
            return da.getTime() - db.getTime();
        });
    }
    catch (error) {
        console.error("Failed to fetch all transactions:", error);
        return [];
    }
}), ["all-transactions-history"], { revalidate: 300, tags: ["transactions"] });
// ============================================================================
// PHASE 9: AUTOMATION RULES (BACKEND)
// ============================================================================
exports.RULES_SHEET_NAME = "Config_Rules";
exports.RULES_SHEET_HEADERS = [
    "ID",
    "Name",
    "TriggerType",
    "Condition",
    "Action",
    "IsActive",
    "LastTriggered",
];
function ensureRulesSheet() {
    return __awaiter(this, void 0, void 0, function* () {
        yield ensureSheetExists(exports.SPREADSHEET_ID, exports.RULES_SHEET_NAME, exports.RULES_SHEET_HEADERS);
    });
}
function getRules() {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield getSheetData(exports.SPREADSHEET_ID, `'${exports.RULES_SHEET_NAME}'!A:G`);
        if (!data || data.length < 2)
            return [];
        return data.slice(1).map((row) => ({
            id: row[0],
            name: row[1],
            triggerType: row[2],
            condition: row[3],
            action: row[4],
            isActive: String(row[5]).toLowerCase() === "true",
            lastTriggered: row[6],
        }));
    });
}
function saveRule(rule) {
    return __awaiter(this, void 0, void 0, function* () {
        // Check if exists
        const rules = yield getRules();
        const index = rules.findIndex((r) => r.id === rule.id);
        // Prepare Row
        const row = [
            rule.id,
            rule.name,
            rule.triggerType,
            rule.condition, // JSON
            rule.action, // JSON
            rule.isActive.toString(),
            rule.lastTriggered || "",
        ];
        if (index === -1) {
            // Create
            yield appendSheetRow(exports.SPREADSHEET_ID, `'${exports.RULES_SHEET_NAME}'!A:G`, row);
        }
        else {
            // Update (Row is index + 2 because header is 1, and array is 0-based)
            const rowNum = index + 2;
            yield updateSheetData(exports.SPREADSHEET_ID, `'${exports.RULES_SHEET_NAME}'!A${rowNum}:G${rowNum}`, [row]);
        }
    });
}
// Helper to parse potential Thai dates (DD/MM/YYYY)
function parseDate(dateStr) {
    if (!dateStr)
        return "";
    // Try standard date first
    let d = new Date(dateStr);
    // Invalid Date Check
    if (isNaN(d.getTime())) {
        // Try DD/MM/YYYY (common in Thai Sheets)
        const parts = dateStr.trim().split("/");
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            let year = parseInt(parts[2], 10);
            // Handle Thai Year (BE) 2568 -> 2025 (approx, valid > 2400)
            if (year > 2400)
                year -= 543;
            // Construct strictly as YYYY-MM-DD string to avoid timezone shifts
            return `${year}-${month.toString().padStart(2, "0")}-${day
                .toString()
                .padStart(2, "0")}`;
        }
        return ""; // Invalid format
    }
    // IF it was a standard date object (e.g. from YYYY-MM-DD or MM/DD/YYYY),
    // ensure we output YYYY-MM-DD relative to the Local/Client timezone, not UTC.
    // However, if the input is YYYY-MM-DD string, Date() assumes UTC usually.
    // Let's rely on string parsing if possible, or manual extraction.
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
// Internal fetcher (uncached) - Exported for Data Quality Check
function getTransactionsUncached(type_1) {
    return __awaiter(this, arguments, void 0, function* (type, targetSheetId = exports.PRODUCT_SPREADSHEET_ID, allowedOwners) {
        // Legacy Sheet Names often include emojis
        const sheetName = type === "IN" ? "💸 Transaction รับ" : "💰 Transaction จ่าย";
        console.log(`[getTransactions] Fetching ${type} from sheet: ${sheetName}`);
        // Try primary name (with emojis)
        let data = yield getSheetData(targetSheetId, `'${sheetName}'!A1:Z2000`);
        // Fallback: If failed, try without emojis (clean names)
        if (!data) {
            const cleanName = type === "IN" ? "💸 Transaction รับ" : "💰 Transaction จ่าย";
            console.log(`[getTransactions] Primary name failed, trying fallback: ${cleanName}`);
            data = yield getSheetData(targetSheetId, `'${cleanName}'!A1:Z2000`);
        }
        if (!data || data.length < 2) {
            console.log(`[getTransactions] No data found in ${sheetName} OR clean variant.`);
            return [];
        }
        const headers = data[0];
        const rows = data.slice(1);
        console.log(`[getTransactions] Headers for ${sheetName}:`, headers);
        // Improved Mapping
        const idxDate = headers.findIndex((h) => h.includes("วันที่"));
        // Find 'ชื่อสินค้า' or 'รายการ'
        const idxName = headers.findIndex((h) => h.includes("ชื่อสินค้า") || h.includes("รายการ"));
        // Find 'จำนวน' but NOT 'จำนวนเงิน' (Amount) or 'ราคา'
        // Improved: Robust matching for Quantity
        const idxQty = headers.findIndex((h) => {
            const val = h.trim();
            const vLower = val.toLowerCase();
            // Match 'จำนวน', 'Qty', 'Quantity', 'Count'
            // Exclude 'เงิน' (Amount), 'ราคา' (Price), 'บาท' (Baht)
            return ((val.includes("จำนวน") ||
                vLower.includes("qty") ||
                vLower.includes("quantity") ||
                vLower.includes("count")) &&
                !val.includes("เงิน") &&
                !val.includes("ราคา") &&
                !val.includes("ราคา") &&
                !val.includes("บาท"));
        });
        // Find Price and DocRef
        const idxPrice = headers.findIndex((h) => h.includes("ราคา") || h.includes("Price") || h.includes("Amount"));
        const idxDoc = headers.findIndex((h) => h.includes("Note") ||
            h.includes("Ref") ||
            h.includes("เอกสาร") ||
            h.includes("อ้างอิง"));
        console.log(`[getTransactions] Indices - Date: ${idxDate}, Name: ${idxName}, Qty: ${idxQty}, Price: ${idxPrice}, Doc: ${idxDoc}`);
        if (idxDate === -1 || idxName === -1 || idxQty === -1) {
            console.error(`[getTransactions] Critical column missing in ${sheetName}`);
            return [];
        }
        const transactions = rows
            .map((r, i) => {
            var _a;
            const qtyRaw = r[idxQty];
            const val = parseFloat((qtyRaw === null || qtyRaw === void 0 ? void 0 : qtyRaw.replace(/,/g, "")) || "0");
            // Validation: If no product name, skip
            if (!r[idxName])
                return null;
            const dateStr = r[idxDate] || "";
            const parsedDate = parseDate(dateStr);
            const price = idxPrice > -1 ? parseFloat(((_a = r[idxPrice]) === null || _a === void 0 ? void 0 : _a.replace(/,/g, "")) || "0") : 0;
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
                owner: r[15] || "",
            };
        })
            .filter((t) => t !== null && t.qty !== 0);
        return (0, ownerFilter_1.filterByOwner)(transactions, allowedOwners);
    });
}
// Export Cached Version
exports.getTransactions = (0, cache_1.unstable_cache)((type, branchSheetId, allowedOwners) => __awaiter(void 0, void 0, void 0, function* () {
    return getTransactionsUncached(type, branchSheetId || exports.PRODUCT_SPREADSHEET_ID, allowedOwners);
}), ["transactions-data-v2"], {
    tags: ["transactions-v2"],
    revalidate: 300, // Cache for 5 minutes (History doesn't change fast)
});
function getStockMovement(sku) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`[getStockMovement] Searching for SKU: "${sku}"`);
        // 1. Fetch All Transactions AND Damage Records
        const [inbound, outbound, damage] = yield Promise.all([
            (0, exports.getTransactions)("IN"),
            (0, exports.getTransactions)("OUT"),
            getDamageRecords(),
        ]);
        console.log(`[getStockMovement] Total Inbound Logs: ${inbound.length}`);
        console.log(`[getStockMovement] Total Outbound Logs: ${outbound.length}`);
        console.log(`[getStockMovement] Total Damage Logs: ${damage.length}`);
        // 2. Filter by SKU
        // Normalize SKU for comparison (trim strings)
        const normalizedSku = sku.trim().toLowerCase();
        const productMovs = [];
        inbound.forEach((t) => {
            if (t.product &&
                t.product.toString().trim().toLowerCase() === normalizedSku) {
                productMovs.push({
                    date: t.date,
                    docRef: "Inbound",
                    type: "IN",
                    in: t.qty,
                    out: 0,
                    balance: 0,
                });
            }
        });
        outbound.forEach((t) => {
            if (t.product &&
                t.product.toString().trim().toLowerCase() === normalizedSku) {
                productMovs.push({
                    date: t.date,
                    docRef: "Outbound",
                    type: "OUT",
                    in: 0,
                    out: t.qty,
                    balance: 0,
                });
            }
        });
        // Process Damage
        damage.forEach((d) => {
            if (d.product_name &&
                d.product_name.toString().trim().toLowerCase() === normalizedSku) {
                productMovs.push({
                    date: d.date,
                    docRef: `Damage: ${d.reason}`, // Use Reason as Doc Ref
                    type: "DAMAGE",
                    in: 0,
                    out: d.quantity, // Treat as Out (Reduction)
                    balance: 0,
                });
            }
        });
        console.log(`[getStockMovement] Found ${productMovs.length} movements for ${sku}`);
        // 3. Sort by Date
        productMovs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // 4. Calculate Running Balance
        let runningBalance = 0;
        return productMovs.map((m) => {
            if (m.type === "IN") {
                runningBalance += m.in;
            }
            else if (m.type === "OUT" || m.type === "DAMAGE") {
                runningBalance -= m.out;
            }
            return Object.assign(Object.assign({}, m), { balance: runningBalance });
        });
    });
}
function getPOLogs(spreadsheetId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Priority 0: Passed ID (Dynamic/Branch-specific)
            // Priority 1: PO_SPREADSHEET_ID (Correct Source for Archive/คลังข้อมูล)
            let rawData = null;
            const targetSSID = spreadsheetId || exports.PO_SPREADSHEET_ID || exports.SPREADSHEET_ID;
            if (targetSSID) {
                try {
                    console.log(`[getPOLogs] Fetching from SSID: ${targetSSID}`);
                    rawData = yield getSheetData(targetSSID, "คลังข้อมูล!A:Z");
                }
                catch (err) {
                    console.warn(`[getPOLogs] Failed to read from SSID: ${targetSSID}`, err);
                }
            }
            // Priority 2: SPREADSHEET_ID (Fallback or if PO ID missing)
            if (!rawData || rawData.length < 2) {
                if (exports.SPREADSHEET_ID &&
                    exports.SPREADSHEET_ID !== exports.PO_SPREADSHEET_ID) {
                    try {
                        console.log(`[getPOLogs] Fallback fetching from SPREADSHEET_ID: ${exports.SPREADSHEET_ID}`);
                        rawData = yield getSheetData(exports.SPREADSHEET_ID, "คลังข้อมูล!A:Z");
                    }
                    catch (err2) {
                        console.warn(`[getPOLogs] Failed to read from Main Sheet ID`, err2);
                    }
                }
            }
            if (!rawData || rawData.length < 2)
                return [];
            const headers = rawData[0];
            const rows = rawData.slice(1);
            // Map by index or name
            const idxOrderNo = headers.findIndex((h) => h.includes("เลขที่ใบสั่ง"));
            const idxCustomer = headers.findIndex((h) => h.includes("ลูกค้า"));
            const idxPoOrder = headers.findIndex((h) => h.includes("NO. Order"));
            const idxItem = headers.findIndex((h) => h.includes("รายการ"));
            const idxQty = headers.findIndex((h) => h.includes("จำนวน"));
            const idxStatus = headers.findIndex((h) => h.includes("Status"));
            const idxPdf = headers.findIndex((h) => h.includes("PDF"));
            const idxDate = headers.findIndex((h) => h.includes("Date")); // Delivery Date
            return rows
                .map((r) => {
                var _a;
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
                    qty: parseFloat(((_a = r[idxQty]) === null || _a === void 0 ? void 0 : _a.replace(/,/g, "")) || "0"),
                    status: r[idxStatus] || "Pending",
                    pdfLink: r[idxPdf] || "",
                    deliveryDate: r[idxDate] || "",
                };
            })
                .filter((i) => i.orderNo)
                .sort((a, b) => b.orderNo.localeCompare(a.orderNo));
        }
        catch (e) {
            console.error("Error fetching PO Logs:", e);
            return [];
        }
    });
}
function getUsers() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Try getting 'Users' sheet. If not exists, might need creation or standard sheet
            const raw = yield getSheetData(exports.SPREADSHEET_ID, "'Users'!A:E");
            if (!raw || raw.length < 2)
                return [];
            return raw.slice(1).map((r, i) => ({
                id: r[0] || `U-${i}`,
                username: r[1] || "Unknown",
                role: r[2] || "User",
                status: r[3] || "Active",
                lastLogin: r[4] || "-",
            }));
        }
        catch (e) {
            console.error("Fetch Users Error:", e);
            return [];
        }
    });
}
function addUser(user) {
    return __awaiter(this, void 0, void 0, function* () {
        const row = [
            `U-${Date.now()}`,
            user.username,
            user.role,
            "Active",
            new Date().toISOString().split("T")[0],
        ];
        yield appendSheetRow(exports.SPREADSHEET_ID, "'Users'!A:E", row);
        return true;
    });
}
function updateUser(userId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        const raw = yield getSheetData(exports.SPREADSHEET_ID, "'Users'!A:E");
        if (!raw)
            return false;
        const idx = raw.findIndex((r) => r[0] === userId);
        if (idx === -1)
            return false;
        const range = `'Users'!B${idx + 1}:D${idx + 1}`;
        const values = [[data.username, data.role, data.status]];
        yield updateSheetData(exports.SPREADSHEET_ID, range, values);
        return true;
    });
}
function uploadImageToDrive(fileName, folderId, imageBase64) {
    return __awaiter(this, void 0, void 0, function* () {
        let drive;
        // 1. Try User OAuth
        const userAuth = (0, oauthClient_1.getOAuth2Client)();
        if (userAuth) {
            drive = googleapis_1.google.drive({ version: "v3", auth: userAuth });
        }
        else {
            const { drive: saDrive } = yield getGoogleDrive();
            drive = saDrive;
        }
        try {
            const fileMetadata = {
                name: fileName,
                parents: [folderId],
            };
            // Handle Base64 (remove prefix data:image/png;base64,)
            const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");
            const bufferStream = new stream_1.default.PassThrough();
            bufferStream.end(buffer);
            const media = {
                mimeType: "image/png", // Assume PNG for signatures
                body: bufferStream,
            };
            const file = yield drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: "id, webViewLink, webContentLink",
            });
            // Make public (Reader) so fetch() and IMAGE() works
            try {
                yield drive.permissions.create({
                    fileId: file.data.id,
                    requestBody: {
                        role: "reader",
                        type: "anyone",
                    },
                });
            }
            catch (permErr) {
                console.warn("Failed to set public permission on signature:", permErr);
            }
            return {
                id: file.data.id,
                link: file.data.webViewLink, // Map to 'link' for consumer
                webViewLink: file.data.webViewLink,
                webContentLink: file.data.webContentLink,
            };
        }
        catch (error) {
            console.error("Error uploading image to Drive:", error);
            throw error;
        }
    });
}
function uploadPdfToDrive(pdfBlob, fileName, folderId) {
    return __awaiter(this, void 0, void 0, function* () {
        let drive;
        const userAuth = (0, oauthClient_1.getOAuth2Client)();
        if (userAuth) {
            console.log("[uploadPdfToDrive] Using OAuth Client (Client Side Flow)");
            drive = googleapis_1.google.drive({ version: "v3", auth: userAuth });
        }
        else {
            console.log("[uploadPdfToDrive] Initializing Drive via getGoogleDrive (Server Side Flow)");
            const { drive: saDrive } = yield getGoogleDrive();
            drive = saDrive;
        }
        try {
            const fileMetadata = {
                name: fileName,
                parents: [folderId],
            };
            // Convert ArrayBuffer to Buffer if needed
            const buffer = pdfBlob instanceof ArrayBuffer ? Buffer.from(pdfBlob) : pdfBlob;
            const bufferStream = new stream_1.default.PassThrough();
            bufferStream.end(buffer);
            const media = {
                mimeType: "application/pdf",
                body: bufferStream,
            };
            const file = yield drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: "id, webViewLink, webContentLink",
            });
            return {
                id: file.data.id,
                link: file.data.webViewLink,
                webViewLink: file.data.webViewLink,
                webContentLink: file.data.webContentLink,
            };
        }
        catch (error) {
            console.error("Error uploading PDF to Drive:", error);
            throw error;
        }
    });
}
function exportSheetToPdf(spreadsheetId_1, sheetId_1, fileName_1, folderId_1) {
    return __awaiter(this, arguments, void 0, function* (spreadsheetId, sheetId, fileName, folderId, range = "A1:H20") {
        console.log(`[exportSheetToPdf] Generating PDF for ${fileName}...`);
        try {
            // 1. Get Blob
            const blob = yield getSheetPdfBlob(spreadsheetId, sheetId, range, false); // Portrait default
            // 2. Upload
            const result = yield uploadPdfToDrive(blob, fileName, folderId);
            return {
                success: true,
                fileId: result.id,
                link: result.webViewLink,
            };
        }
        catch (e) {
            console.error("Export PDF Error:", e);
            throw e;
        }
    });
}
function getDamageRecords() {
    return __awaiter(this, void 0, void 0, function* () {
        // "Damage" Sheet - A to K range
        const data = yield getSheetData(exports.SPREADSHEET_ID, `'Damage'!A1:K1000`);
        if (!data || data.length < 2)
            return [];
        const rows = data.slice(1);
        // Columns: Date, Name, Qty, Unit, Reason, Notes, Reporter, Status, Approver, ApproveDate, SentToHq
        return rows.map((r, i) => {
            var _a;
            return ({
                rowIndex: i + 2, // Header is 1, so data starts at 2
                date: r[0],
                product_name: r[1],
                quantity: parseFloat(((_a = r[2]) === null || _a === void 0 ? void 0 : _a.replace(/,/g, "")) || "0"),
                unit: r[3],
                reason: r[4],
                notes: r[5],
                reported_by: r[6],
                status: r[7] || "Pending",
                approved_by: r[8],
                approved_date: r[9],
                sent_to_hq: r[10] || "ยังไม่ส่ง", // Parse column K
            });
        });
    });
}
function addDamageRecord(data) {
    return __awaiter(this, void 0, void 0, function* () {
        // Format: Date, Name, Qty, Unit, Reason, Notes, Reporter, Status, Approver, ApproveDate, SentToHq
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
            data.approved_date,
            data.sent_to_hq || "ยังไม่ส่ง",
        ];
        yield appendSheetRow(exports.SPREADSHEET_ID, "'Damage'!A:K", row);
        return true;
    });
}
function updateDamageStatusByRow(rowNumber, status, approver) {
    return __awaiter(this, void 0, void 0, function* () {
        if (rowNumber < 2)
            return false;
        const date = new Date().toISOString().split("T")[0];
        const range = `'Damage'!H${rowNumber}:J${rowNumber}`; // H=Status, I=Approver, J=Date
        const values = [[status, approver, date]];
        yield updateSheetData(exports.SPREADSHEET_ID, range, values);
        return true;
    });
}
function updateDamageHqStatusByRow(rowNumber, sentToHq) {
    return __awaiter(this, void 0, void 0, function* () {
        if (rowNumber < 2)
            return false;
        const range = `'Damage'!K${rowNumber}:K${rowNumber}`; // K=SentToHq
        const values = [[sentToHq]];
        yield updateSheetData(exports.SPREADSHEET_ID, range, values);
        return true;
    });
}
function getCycleCountLogs() {
    return __awaiter(this, void 0, void 0, function* () {
        const data = yield getSheetData(exports.SPREADSHEET_ID, `'CycleCount_Log'!A1:J1000`);
        if (!data || data.length < 2)
            return [];
        const rows = data.slice(1);
        return rows.map((r) => {
            var _a, _b, _c;
            return ({
                product_name: r[0],
                location: r[1],
                due_date: r[2],
                count_date: r[3],
                inspector: r[4],
                notes: r[5],
                system_qty: parseFloat(((_a = r[6]) === null || _a === void 0 ? void 0 : _a.replace(/,/g, "")) || "0"),
                actual_qty: parseFloat(((_b = r[7]) === null || _b === void 0 ? void 0 : _b.replace(/,/g, "")) || "0"),
                variance: parseFloat(((_c = r[8]) === null || _c === void 0 ? void 0 : _c.replace(/,/g, "")) || "0"),
                status: r[9] || "Unknown",
            });
        });
    });
}
function addCycleCountEntry(data) {
    return __awaiter(this, void 0, void 0, function* () {
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
            data.status,
        ];
        yield appendSheetRow(exports.PRODUCT_SPREADSHEET_ID, "'CycleCount_Log'!A:J", row);
        return true;
    });
}
function getActiveItemsToday() {
    return __awaiter(this, void 0, void 0, function* () {
        // 1. Get Today's Date in YYYY-MM-DD
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        // Note: Sheet buffer might be day/month swapped or different format, strict comparison might miss.
        // Ideally we check parsing.
        // We need to check both IN and OUT transactions
        const [inbound, outbound] = yield Promise.all([
            (0, exports.getTransactions)("IN"),
            (0, exports.getTransactions)("OUT"),
        ]);
        const activeSet = new Set();
        // Helper to check if date matches today
        const isToday = (dateStr) => {
            if (!dateStr)
                return false;
            // Check exact match YYYY-MM-DD
            if (dateStr.includes(`${yyyy}-${mm}-${dd}`))
                return true;
            // Check Thai format DD/MM/YYYY (e.g. 10/01/2569)
            // If we really want to be robust, we parse.
            // But getTransactions() returns parsed "YYYY-MM-DD" in .date if successful.
            return dateStr === `${yyyy}-${mm}-${dd}`;
        };
        inbound.forEach((t) => {
            if (!t)
                return;
            const name = t.product || t.sku;
            if (name && isToday(t.date))
                activeSet.add(name);
        });
        outbound.forEach((t) => {
            if (!t)
                return;
            const name = t.product || t.sku;
            if (name && isToday(t.date))
                activeSet.add(name);
        });
        return Array.from(activeSet);
    });
}
// ============================================================================
// AUDIT LOG FUNCTIONS (Persistent)
// ============================================================================
exports.AUDIT_SHEET_NAME = "12.Audit Logs"; // Named 12.Audit Logs to organize
// Internal helper to create a sheet if missing
function createSheet(spreadsheetId, sheetName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            yield googleSheets.spreadsheets.batchUpdate({
                auth: auth,
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: { title: sheetName },
                            },
                        },
                    ],
                },
            });
            // Add Headers
            const headers = [
                "Timestamp",
                "User ID",
                "User Name",
                "Action",
                "Module",
                "Record ID",
                "Description",
                "IP Address",
            ];
            yield appendSheetRow(spreadsheetId, `'${sheetName}'!A1:H1`, headers);
            console.log(`Created new sheet: ${sheetName}`);
            return true;
        }
        catch (error) {
            // Ignore if already exists (race condition)
            if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("already exists"))
                return true;
            console.error("Error creating sheet:", error);
            return false;
        }
    });
}
function appendAuditLog(log) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const row = [
                log.timestamp,
                log.userId,
                log.userName,
                log.action,
                log.module,
                log.recordId || "",
                log.description,
                log.ipAddress || "",
            ];
            // Use '12.Audit Logs' sheet
            yield appendSheetRow(exports.SPREADSHEET_ID, `'${exports.AUDIT_SHEET_NAME}'!A:H`, row);
        }
        catch (error) {
            // Simple error check: If range not found, try create and retry
            console.warn("Append failed, attempting to create sheet and retry...", error.message);
            const created = yield createSheet(exports.SPREADSHEET_ID, exports.AUDIT_SHEET_NAME);
            if (created) {
                const row = [
                    log.timestamp,
                    log.userId,
                    log.userName,
                    log.action,
                    log.module,
                    log.recordId || "",
                    log.description,
                    log.ipAddress || "",
                ];
                yield appendSheetRow(exports.SPREADSHEET_ID, `'${exports.AUDIT_SHEET_NAME}'!A:H`, row);
            }
        }
    });
}
function fetchAuditLogsFromSheet() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Check if sheet exists implicitly by trying to read
            const data = yield getSheetData(exports.SPREADSHEET_ID, `'${exports.AUDIT_SHEET_NAME}'!A:H`);
            // If data is null/undefined, it might mean sheet doesn't exist or is empty
            if (!data || data.length < 2)
                return [];
            // Reverse to show newest first
            return data
                .slice(1)
                .map((row, i) => ({
                id: `log-${Date.now()}-${i}`,
                timestamp: row[0],
                userId: row[1],
                userName: row[2],
                action: row[3],
                module: row[4],
                recordId: row[5],
                description: row[6],
                ipAddress: row[7],
            }))
                .reverse();
        }
        catch (error) {
            console.error("Failed to fetch audit logs (Sheet likely missing):", error);
            return [];
        }
    });
}
function getBranchesFromSheet() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const sheetName = "Config_Branches";
            // Ensure sheet exists first
            yield ensureSheetExists(exports.USER_SPREADSHEET_ID, sheetName);
            const data = yield getSheetData(exports.USER_SPREADSHEET_ID, `'${sheetName}'!A1:G100`);
            if (!data || data.length < 2) {
                // If empty, return default or empty list
                return [];
            }
            const headers = data[0].map((h) => h.trim().toLowerCase());
            // Helper to find column index
            const getColIndex = (keywords) => headers.findIndex((h) => keywords.some(k => h === k.toLowerCase() || h.includes(k.toLowerCase())));
            const idxId = getColIndex(["id", "branch id"]);
            const idxName = getColIndex(["name", "ชื่อ"]);
            const idxSpreadsheetId = getColIndex(["spreadsheet id", "spreadsheet", "doc id"]);
            const idxInvSpreadsheetId = getColIndex(["inventory id", "inventory spreadsheet"]);
            const idxColor = getColIndex(["color", "สี"]);
            const idxStatus = getColIndex(["status", "สถานะ"]);
            const rows = data.slice(1); // Skip Header
            return rows
                .map((row) => {
                const id = idxId > -1 ? row[idxId] : row[0];
                const name = idxName > -1 ? row[idxName] : row[1];
                const spreadsheetId = idxSpreadsheetId > -1 ? row[idxSpreadsheetId] : row[2];
                const inventorySpreadsheetIdRaw = idxInvSpreadsheetId > -1 ? row[idxInvSpreadsheetId] : row[3];
                const colorRaw = idxColor > -1 ? row[idxColor] : row[4];
                const statusRaw = idxStatus > -1 ? row[idxStatus] : row[5];
                // Smart fallback: If color is a spreadsheet ID
                const isColorStringId = colorRaw && colorRaw.length >= 20;
                const finalInventoryId = inventorySpreadsheetIdRaw || (isColorStringId ? colorRaw : spreadsheetId);
                const color = isColorStringId ? "slate" : (colorRaw || "slate");
                return {
                    id: id || "",
                    name: name || "",
                    spreadsheetId: spreadsheetId || "",
                    inventorySpreadsheetId: finalInventoryId || spreadsheetId || "",
                    color: color,
                    status: statusRaw || "Active",
                };
            })
                .filter((b) => b.id && b.status !== "Inactive");
        }
        catch (error) {
            console.error("Error fetching branches:", error);
            return [];
        }
    });
}
function saveBranchToSheet(branch) {
    return __awaiter(this, void 0, void 0, function* () {
        const sheetName = "Config_Branches";
        yield ensureSheetExists(exports.USER_SPREADSHEET_ID, sheetName);
        // 1. Get existing data to check for updates vs inserts
        const data = yield getSheetData(exports.USER_SPREADSHEET_ID, `'${sheetName}'!A1:F100`);
        // Headers if new
        if (!data || data.length === 0) {
            yield updateSheetData(exports.USER_SPREADSHEET_ID, `'${sheetName}'!A1:F1`, [
                ["ID", "Name", "Spreadsheet ID", "Inventory ID", "Color", "Status"],
            ]);
        }
        const rows = data ? data.slice(1) : [];
        const rowIndex = rows.findIndex((r) => r[0] === branch.id);
        const rowData = [
            branch.id,
            branch.name,
            branch.spreadsheetId,
            branch.inventorySpreadsheetId || branch.spreadsheetId,
            branch.color,
            branch.status,
        ];
        if (rowIndex > -1) {
            // Update existing
            // Row in sheet is rowIndex + 2 (1 for header, 1 for 0-index)
            yield updateSheetData(exports.USER_SPREADSHEET_ID, `'${sheetName}'!A${rowIndex + 2}:F${rowIndex + 2}`, [rowData]);
        }
        else {
            // Append new
            yield appendSheetRow(exports.USER_SPREADSHEET_ID, sheetName, rowData);
        }
        return true;
    });
}
function deleteBranchFromSheet(branchId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Soft Delete: Set Status to 'Inactive'
        const branches = yield getBranchesFromSheet();
        const branch = branches.find((b) => b.id === branchId);
        if (!branch)
            return false;
        branch.status = "Inactive";
        return yield saveBranchToSheet(branch);
    });
}
// ============================================================================
// PHASE 12: USER CONFIGURATION (Config_Users)
// ============================================================================
// Helper to ensure a sheet exists
function ensureSheetWithHeaders(sheetTitle_1) {
    return __awaiter(this, arguments, void 0, function* (sheetTitle, headers = []) {
        var _a;
        try {
            const { googleSheets, auth } = yield getGoogleSheets();
            // 1. Get current sheets
            const meta = yield googleSheets.spreadsheets.get({
                auth: auth,
                spreadsheetId: exports.SPREADSHEET_ID,
                fields: "sheets.properties.title",
            });
            const exists = (_a = meta.data.sheets) === null || _a === void 0 ? void 0 : _a.some((s) => { var _a; return ((_a = s.properties) === null || _a === void 0 ? void 0 : _a.title) === sheetTitle; });
            if (!exists) {
                console.log(`Sheet '${sheetTitle}' missing. Creating...`);
                // 2. Create Sheet
                yield googleSheets.spreadsheets.batchUpdate({
                    auth: auth,
                    spreadsheetId: exports.SPREADSHEET_ID,
                    requestBody: {
                        requests: [
                            {
                                addSheet: {
                                    properties: { title: sheetTitle },
                                },
                            },
                        ],
                    },
                });
                // 3. Add Headers if provided
                if (headers.length > 0) {
                    yield googleSheets.spreadsheets.values.update({
                        auth: auth,
                        spreadsheetId: exports.SPREADSHEET_ID,
                        range: `'${sheetTitle}'!A1`,
                        valueInputOption: "USER_ENTERED",
                        requestBody: {
                            values: [headers],
                        },
                    });
                }
                console.log(`Sheet '${sheetTitle}' created successfully.`);
            }
        }
        catch (error) {
            console.error(`Failed to ensure sheet '${sheetTitle}' exists:`, error);
            // Don't throw, let the subsequent call fail naturally or handle it there
        }
    });
}
function getUserConfig(userId, key) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const rows = yield getSheetData(exports.SPREADSHEET_ID, "'Config_Users'!A:C");
            if (!rows || rows.length < 2)
                return null;
            // Find row matching UserId and Key
            // Row[0] = UserID, Row[1] = Key, Row[2] = Value
            const found = rows.find((r) => r[0] === userId && r[1] === key);
            if (found && found[2]) {
                try {
                    return JSON.parse(found[2]);
                }
                catch (_a) {
                    return found[2];
                }
            }
            return null;
        }
        catch (error) {
            // If sheet doesn't exist, getSheetData might throw. Handle gracefully.
            console.warn(`Failed to get config for ${userId} (Sheet might be missing):`, error);
            return null;
        }
    });
}
function saveUserConfig(userId, key, value) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const sheetName = "Config_Users";
            // Ensure sheet exists before saving
            yield ensureSheetWithHeaders(sheetName, [
                "UserID",
                "Key",
                "Value",
                "UpdatedAt",
            ]);
            const { googleSheets, auth } = yield getGoogleSheets();
            // 1. Get all rows to check for existence
            const rows = yield getSheetData(exports.SPREADSHEET_ID, `'${sheetName}'!A:C`);
            let rowIndex = -1;
            if (rows && rows.length > 0) {
                rowIndex = rows.findIndex((r) => r[0] === userId && r[1] === key);
            }
            const valueStr = JSON.stringify(value);
            const timestamp = new Date().toISOString();
            if (rowIndex !== -1) {
                // 2. Update existing row
                // rowIndex is 0-based index of the array. Sheet rows are 1-based.
                // Since we fetched range A:C, logic assumes A1 is start.
                // If header exists, row 0 is header.
                yield googleSheets.spreadsheets.values.update({
                    auth: auth,
                    spreadsheetId: exports.SPREADSHEET_ID,
                    range: `'${sheetName}'!C${rowIndex + 1}`, // Update Value column only?
                    // Wait, if we fetched A:C, rowIndex + 1 is the actual sheet row number?
                    // `getSheetData` usually returns values[][] where index 0 is row 1 (if no offset).
                    // Yes.
                    valueInputOption: "USER_ENTERED",
                    requestBody: {
                        values: [[valueStr]],
                    },
                });
            }
            else {
                // 3. Append new row
                yield googleSheets.spreadsheets.values.append({
                    auth: auth,
                    spreadsheetId: exports.SPREADSHEET_ID,
                    range: `'${sheetName}'!A:C`,
                    valueInputOption: "USER_ENTERED",
                    requestBody: {
                        values: [[userId, key, valueStr, timestamp]],
                    },
                });
            }
            return true;
        }
        catch (error) {
            console.error(`Failed to save config for ${userId}:`, error);
            return false;
        }
    });
}
/**
 * Robustly find a sheet title by keywords or default name
 * Prevents issues if users rename sheets with extra spaces or different casing
 */
function findSheetTitle(spreadsheetId, keywords, defaultTitle) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { googleSheets } = yield getGoogleSheets();
        try {
            const meta = yield googleSheets.spreadsheets.get({
                spreadsheetId,
                fields: 'sheets.properties.title'
            });
            const titles = ((_a = meta.data.sheets) === null || _a === void 0 ? void 0 : _a.map((s) => s.properties.title)) || [];
            // 1. Exact Match (with trim)
            for (const k of [defaultTitle, ...keywords]) {
                const match = titles.find(t => t.toLowerCase().trim() === k.toLowerCase().trim());
                if (match)
                    return match;
            }
            // 2. Partial Match (All keywords must exist)
            for (const title of titles) {
                const tLower = title.toLowerCase();
                const hasAll = keywords.every(k => tLower.includes(k.toLowerCase()));
                if (hasAll)
                    return title;
            }
        }
        catch (err) {
            console.error("Failed to fetch sheet metadata in findSheetTitle:", err);
        }
        return defaultTitle;
    });
}
function cleanupTempRollTagSheets(spreadsheetId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            const meta = yield googleSheets.spreadsheets.get({
                auth: auth,
                spreadsheetId,
                fields: "sheets.properties",
            });
            const sheetsToDelete = ((_a = meta.data.sheets) === null || _a === void 0 ? void 0 : _a.filter(s => {
                var _a;
                const title = ((_a = s.properties) === null || _a === void 0 ? void 0 : _a.title) || "";
                if (title.startsWith("Roll Tag")) {
                    const numPart = title.replace("Roll Tag", "").trim();
                    const num = parseInt(numPart);
                    return !isNaN(num) && num > 2;
                }
                return false;
            })) || [];
            if (sheetsToDelete.length > 0) {
                console.log(`[GoogleSheets] Found ${sheetsToDelete.length} temporary Roll Tag sheets to delete.`);
                const requests = sheetsToDelete.map(s => {
                    var _a;
                    return ({
                        deleteSheet: {
                            sheetId: (_a = s.properties) === null || _a === void 0 ? void 0 : _a.sheetId
                        }
                    });
                });
                yield googleSheets.spreadsheets.batchUpdate({
                    auth: auth,
                    spreadsheetId,
                    requestBody: {
                        requests
                    }
                });
                console.log(`[GoogleSheets] Successfully deleted temporary Roll Tag sheets.`);
            }
        }
        catch (error) {
            console.error("Error cleaning up temporary Roll Tag sheets:", error);
        }
    });
}
function clearRollTagForm(spreadsheetId, sheetName) {
    return __awaiter(this, void 0, void 0, function* () {
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            const emptyCol9 = Array(9).fill([""]);
            const updates = [
                { range: `${sheetName}!B4`, values: [[""]] },
                { range: `${sheetName}!A9:A17`, values: emptyCol9 },
                { range: `${sheetName}!B9:B17`, values: emptyCol9 },
                // Column C contains formulas like VLOOKUP, so we DO NOT clear it to preserve them.
                // Once Column B is cleared, Column C's formulas will automatically display as empty.
                { range: `${sheetName}!D9:D17`, values: emptyCol9 },
                { range: `${sheetName}!E9:E17`, values: emptyCol9 },
            ];
            yield googleSheets.spreadsheets.values.batchUpdate({
                auth: auth,
                spreadsheetId,
                requestBody: {
                    valueInputOption: "USER_ENTERED",
                    data: updates,
                },
            });
            console.log(`Successfully cleared data form in ${sheetName}`);
        }
        catch (error) {
            console.error(`Error clearing Roll Tag form for ${sheetName}:`, error);
        }
    });
}
function ensureRollTagSheet(spreadsheetId, sheetName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const { googleSheets, auth } = yield getGoogleSheets();
        try {
            const sheetId = yield getSheetId(spreadsheetId, sheetName);
            if (sheetId !== null)
                return sheetId;
            console.log(`[GoogleSheets] Sheet '${sheetName}' missing. Creating...`);
            const numPart = sheetName.replace("Roll Tag", "").trim();
            const num = parseInt(numPart);
            if (!isNaN(num) && num > 2) {
                const sourceSheetId = yield getSheetId(spreadsheetId, "Roll Tag1");
                if (sourceSheetId !== null) {
                    console.log(`[GoogleSheets] Duplicating 'Roll Tag1' to create '${sheetName}'...`);
                    const res = yield googleSheets.spreadsheets.batchUpdate({
                        auth: auth,
                        spreadsheetId,
                        requestBody: {
                            requests: [
                                {
                                    duplicateSheet: {
                                        sourceSheetId,
                                        newSheetName: sheetName
                                    }
                                }
                            ]
                        }
                    });
                    const newSheetId = (_d = (_c = (_b = (_a = res.data.replies) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.duplicateSheet) === null || _c === void 0 ? void 0 : _c.properties) === null || _d === void 0 ? void 0 : _d.sheetId;
                    return newSheetId || null;
                }
            }
            yield ensureSheetExists(spreadsheetId, sheetName);
            return yield getSheetId(spreadsheetId, sheetName);
        }
        catch (error) {
            console.error(`Error ensuring Roll Tag sheet '${sheetName}':`, error);
            throw error;
        }
    });
}
