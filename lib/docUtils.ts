import { getSheetData, updateSheetData, PO_SPREADSHEET_ID } from './googleSheets';

export async function generateNewDocNumber() {
    try {
        // Read 'เลขที่เอกสาร' from PO Spreadsheet
        const allValues = await getSheetData(PO_SPREADSHEET_ID, "'เลขที่เอกสาร'!A:A");
        
        // Find last doc num
        let lastDocNum = "20250101-000";
        let lastRowIndex = 1;

        if (allValues && allValues.length > 0) {
            // Loop backwards to find last non-empty
            for (let i = allValues.length - 1; i >= 0; i--) {
                const row = allValues[i];
                if (row && row[0] && row[0].trim() !== "") {
                    lastDocNum = row[0].trim();
                    lastRowIndex = i + 1; // 1-based index
                    break;
                }
            }
        }

        // Generate New Num (Thailand Time)
        // Format: YYYYMMDD-XXX
        const now = new Date();
        const thDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
        const year = thDate.getFullYear();
        const month = String(thDate.getMonth() + 1).padStart(2, '0');
        const day = String(thDate.getDate()).padStart(2, '0');
        const todayStr = `${year}${month}${day}`;
        const currentMonthPrefix = `${year}${month}`;

        let newSeq = 1;

        const parts = lastDocNum.split('-');
        if (parts.length === 2) {
            const lastDate = parts[0]; // YYYYMMDD
            const lastSeq = parseInt(parts[1]);
            
            // Check if same month (YYYYMM)
            if (lastDate.substring(0, 6) === currentMonthPrefix) {
                newSeq = lastSeq + 1;
            }
        }

        const newDocNum = `${todayStr}-${String(newSeq).padStart(3, '0')}`;
        
        // Write to next row in 'เลขที่เอกสาร'
        await updateSheetData(PO_SPREADSHEET_ID, `'เลขที่เอกสาร'!A${lastRowIndex + 1}`, [[newDocNum]]);

        return newDocNum;

    } catch (error) {
        console.error("Error generating doc number:", error);
        throw error;
    }
}
