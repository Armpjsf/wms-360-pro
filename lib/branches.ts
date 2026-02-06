
export interface Branch {
    id: string;
    name: string;
    spreadsheetId: string;
    color: string;
}

// Mocking Branch 2 with the same sheet ID for testing purposes
// In production, these would be different IDs.
const MAIN_SHEET_ID = process.env.SPREADSHEET_ID || '1Jp9sM6b...'; // Fallback will be handled in googleSheets.ts

export const BRANCHES: Branch[] = [
    {
        id: 'hq',
        name: 'สำนักงานใหญ่ (HQ)',
        spreadsheetId: process.env.SPREADSHEET_ID || '', // Configured in .env
        color: 'indigo'
    },
    {
        id: 'branch-2',
        name: 'สาขา 2 (Rangsit)',
        spreadsheetId: process.env.SPREADSHEET_ID || '', // Using same ID for demo
        color: 'rose'
    }
];

export const getBranch = (id: string) => BRANCHES.find(b => b.id === id) || BRANCHES[0];
