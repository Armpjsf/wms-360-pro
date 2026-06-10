import { getSheetData, updateSheetData, PO_SPREADSHEET_ID } from './googleSheets';

export async function generateNewDocNumber(spreadsheetId?: string) {
    try {
        const targetSSID = spreadsheetId || PO_SPREADSHEET_ID;
        // Read 'เลขที่เอกสาร' from target Spreadsheet
        const allValues = await getSheetData(targetSSID, "'เลขที่เอกสาร'!A:A");
        
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
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const parts = formatter.formatToParts(now);
        const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
        const year = partMap.year;
        const month = partMap.month;
        const day = partMap.day;
        const todayStr = `${year}${month}${day}`;
        const currentMonthPrefix = `${year}${month}`;

        let newSeq = 1;

        const docParts = lastDocNum.split('-');
        if (docParts.length === 2) {
            const lastDate = docParts[0]; // YYYYMMDD
            const lastSeq = parseInt(docParts[1]);
            
            // Check if same month (YYYYMM)
            if (lastDate.substring(0, 6) === currentMonthPrefix) {
                newSeq = lastSeq + 1;
            }
        }

        const newDocNum = `${todayStr}-${String(newSeq).padStart(3, '0')}`;
        
        // Write to next row in 'เลขที่เอกสาร'
        await updateSheetData(targetSSID, `'เลขที่เอกสาร'!A${lastRowIndex + 1}`, [[newDocNum]]);

        return newDocNum;

    } catch (error) {
        console.error("Error generating doc number:", error);
        throw error;
    }
}
