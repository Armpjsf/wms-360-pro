import { getSheetData, appendSheetRow, updateSheetData, USER_SPREADSHEET_ID } from "./googleSheets";
import bcrypt from 'bcryptjs';

// ============================================================================
// USER MANAGEMENT (REAL - USERS SHEET)
// ============================================================================
export interface User {
    id: string;
    username: string;
    role: string;
    status: string;
    lastLogin: string;
    password?: string; // Hashed (Internal use only)
    allowedBranches?: string[]; // New: List of Branch IDs or ['*']
    allowedOwners?: string[];   // Enterprise: Owner/Customer codes or ['*'] for all
}

export async function getUsers(): Promise<User[]> {
    try {
        // Fetch up to Column G (Index 6) for AllowedBranches
        const raw = await getSheetData(USER_SPREADSHEET_ID, "'Users'!A:G");
        if (!raw || raw.length < 2) return [];

        return raw.slice(1).map((r, i) => ({
             id: r[0] || `U-${i}`,
             username: r[1] || "Unknown",
             role: r[2] || "User",
             status: r[3] || "Active",
             lastLogin: r[4] || "-",
             // Password at r[5]
             allowedBranches: r[6] ? r[6].split(',').map((s: string) => s.trim()) : ['*'] // Default: All Access
        }));
    } catch (e) {
        console.error("Fetch Users Error:", e);
        return [];
    }
}

export async function verifyUser(username: string, password: string): Promise<User | null> {
    try {
        const raw = await getSheetData(USER_SPREADSHEET_ID, "'Users'!A:G");
        if (!raw || raw.length < 2) {
             // Default Admin Backdoor
             if (username === 'admin' && password === 'admin') {
                 return { id: 'admin', username: 'admin', role: 'Super Admin', status: 'Active', lastLogin: new Date().toISOString(), allowedBranches: ['*'] };
             }
             return null;
        }

        const userRow = raw.slice(1).find(r => r[1]?.toLowerCase() === username.toLowerCase());
        
        if (!userRow) {
             if (username === 'admin' && password === 'admin') {
                 return { id: 'admin', username: 'admin', role: 'Super Admin', status: 'Active', lastLogin: new Date().toISOString(), allowedBranches: ['*'] };
             }
             return null;
        }

        const storedHash = userRow[5];
        const status = userRow[3];

        if (status !== 'Active') return null;

        let isValid = false;
        if (storedHash) {
            isValid = await bcrypt.compare(password, storedHash);
        }

        if (isValid) {
            return {
                id: userRow[0],
                username: userRow[1],
                role: userRow[2],
                status: userRow[3],
                lastLogin: new Date().toISOString(),
                allowedBranches: userRow[6] ? userRow[6].split(',').map((s: string) => s.trim()) : ['*']
            };
        }

        return null;

    } catch (error) {
        console.error("Verify User Error:", error);
        return null;
    }
}

export async function addUser(user: any) {
    const hashedPassword = await bcrypt.hash(user.password || '123456', 10);
    const branches = user.allowedBranches ? user.allowedBranches.join(',') : '*';
    const row = [
        `U-${Date.now()}`,
        user.username,
        user.role,
        "Active",
        new Date().toISOString().split('T')[0],
        hashedPassword, // Column F
        branches        // Column G
    ];
    await appendSheetRow(USER_SPREADSHEET_ID, "'Users'!A:G", row);
    return true;
}

export async function updateUser(userId: string, data: any) {
    const raw = await getSheetData(USER_SPREADSHEET_ID, "'Users'!A:A"); // Just fetch IDs to find index
    if (!raw) return false;
    
    const idx = raw.findIndex(r => r[0] === userId);
    if (idx === -1) return false;
    
    // Update basic info (B:D)
    // We ideally should update everything if we have clean data, but partial updates are tricky with sheets if we don't have full row.
    // For now, let's assume 'data' generally has everything we care to update in the admin UI.
    // Admin UI currently passes: role, status, allowedBranches? (We will add that)
    
    // If we want to update ONLY specific fields, it's harder with basic range updates unless we send nulls?
    // Let's execute separate updates or one block if contiguous.
    // B:D is contiguous. G is separate (col 6).
    // Let's update B:D first.
    
    if (data.username || data.role || data.status) {
         // This assumes we have original values for others if we want to preserve? 
         // Actually, safer to fetch row first.
         const fullRow = (await getSheetData(USER_SPREADSHEET_ID, `'Users'!A${idx+1}:G${idx+1}`))[0];
         if (!fullRow) return false;

         const newUsername = data.username || fullRow[1];
         const newRole = data.role || fullRow[2];
         const newStatus = data.status || fullRow[3];
         const newBranches = data.allowedBranches ? data.allowedBranches.join(',') : (fullRow[6] || '*');

         // Update B:D
         await updateSheetData(USER_SPREADSHEET_ID, `'Users'!B${idx + 1}:D${idx + 1}`, [[newUsername, newRole, newStatus]]);
         
         // Update G
         await updateSheetData(USER_SPREADSHEET_ID, `'Users'!G${idx + 1}:G${idx + 1}`, [[newBranches]]);
    }

    return true;
}
