import { NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/gmailClient';
// force-rebuild
import { extractRollTagData } from '@/lib/emailParser';
import { PO_SPREADSHEET_ID, getSheetData, appendSheetData } from '@/lib/googleSheets';
import { getThaiDateString } from '@/lib/dateUtils';
import { STATUS_PENDING_ROLLTAG } from '@/lib/orderUtils';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const gmail = await getGmailClient();
    
    if (!gmail) {
        console.error("Gmail client failed to initialize.");
        return NextResponse.json({ error: "Failed to initialize Gmail client" }, { status: 500 });
    }

    // 0. Verify Identity
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const connectedEmail = profile.data.emailAddress;
    console.log(`Connected as: ${connectedEmail}`);

    // Query existing pending Roll Tags in คลังข้อมูล to determine next available RT numbers
    const archiveData = await getSheetData(PO_SPREADSHEET_ID, "'คลังข้อมูล'!A:I").catch(() => []);
    const usedRtNums = new Set<number>();
    if (archiveData && archiveData.length > 1) {
        for (let r = 1; r < archiveData.length; r++) {
            const row = archiveData[r];
            const docNum = String(row?.[0] || '').trim();
            const status = String(row?.[6] || '').trim();
            if (status === STATUS_PENDING_ROLLTAG) {
                const match = docNum.match(/^RT(\d+)$/i);
                if (match) {
                    usedRtNums.add(parseInt(match[1], 10));
                }
            }
        }
    }

    let nextRtCounter = 1;
    const allocateNextRtId = (): string => {
        while (usedRtNums.has(nextRtCounter)) {
            nextRtCounter++;
        }
        const id = `RT${nextRtCounter}`;
        usedRtNums.add(nextRtCounter);
        return id;
    };

    // 1. List Emails (Detailed Search: Unread + Sender)
    // Legacy: is:unread from:formica.com has:attachment
    const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread from:formica.com has:attachment',
        maxResults: 10
    });

    const messages = res.data.messages || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const debugLogs: string[] = [
        `Connected to: ${connectedEmail}`, 
        `Found ${messages.length} unread emails.`
    ];

    console.log(`Found ${messages.length} messages. Processing...`);

    // Helper: Recursive attachment finder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findAttachments = (parts: any[]): any[] => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let attachments: any[] = [];
        for (const part of parts) {
            if (part.filename && part.body && part.body.attachmentId) {
                attachments.push(part);
            }
            if (part.parts) {
                attachments = attachments.concat(findAttachments(part.parts));
            }
        }
        return attachments;
    };

    for (const msg of messages) {
        if (!msg.id) continue;
        
        try {
            const message = await gmail.users.messages.get({ userId: 'me', id: msg.id });
            const payload = message.data.payload;
            const headers = payload?.headers;
            const subject = headers?.find(h => h.name === 'Subject')?.value || "(No Subject)";
            
            console.log(`Checking: ${subject}`);
            
            // Find Attachments
            const allParts = payload?.parts ? findAttachments(payload.parts) : [];
            if (payload?.body?.attachmentId && payload?.filename) allParts.push(payload);

            let emailProcessed = false;

            if (allParts.length === 0) {
                console.log(`[Scan] No attachments in: "${subject}"`);
                debugLogs.push(`Skipped [${subject}]: No attachments found.`);
            } else {
                console.log(`[Scan] Found ${allParts.length} attachment(s) in: "${subject}"`);
            }

            for (const part of allParts) {
                const fileName = part.filename || "";
                const lowerName = fileName.toLowerCase();
                
                if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
                    console.log(`  Found Attachment: ${fileName}`);
                    
                    const attachment = await gmail.users.messages.attachments.get({
                        userId: 'me',
                        messageId: msg.id,
                        id: part.body.attachmentId
                    });
                    
                    if (attachment.data.data) {
                        const buffer = Buffer.from(attachment.data.data, 'base64');
                        const extractedCustomers = extractRollTagData(buffer, fileName); 
                        
                        console.log(`[Scan] extractedCustomers: ${extractedCustomers.length} from "${fileName}"`);
                        if (extractedCustomers.length > 0) {
                            for (const customerData of extractedCustomers) {
                                const targetTagId = allocateNextRtId();
                                const today = getThaiDateString();

                                // Save directly into คลังข้อมูล (Single Source of Truth)
                                // Col schema: [DocNum, CustName, Seq, OrderNo, ItemCode, Qty, Status, Link, Date]
                                const rowsToAppend = customerData.items.map((item, idx) => [
                                    targetTagId,
                                    customerData.customerId,
                                    idx + 1,
                                    item.orderNo || "",
                                    item.itemCode || "",
                                    item.quantity ?? "",
                                    STATUS_PENDING_ROLLTAG,
                                    "",
                                    today
                                ]);

                                await appendSheetData(PO_SPREADSHEET_ID, "'คลังข้อมูล'!A:I", rowsToAppend, 'INSERT_ROWS');
                                
                                const successMsg = { 
                                    msgId: msg.id, 
                                    file: fileName, 
                                    customer: customerData.customerId,
                                    sheet: targetTagId,
                                    tagId: targetTagId,
                                    itemCount: customerData.items.length,
                                    status: "success" 
                                };
                                results.push(successMsg);
                                debugLogs.push(`✅ Success: ${fileName} -> ${targetTagId} (${customerData.customerId}, ${customerData.items.length} รายการ)`);
                                emailProcessed = true;
                            }
                        } else {
                            debugLogs.push(`⚠️ Skipped [${subject}]: File parsed but no valid data found.`);
                        }
                    }
                } else {
                     debugLogs.push(`Skipped [${subject}]: Attachment '${fileName}' not supported.`);
                }
            }

            // Mark as Read iif processed - GRACEFUL FAIL
            if (emailProcessed) {
                try {
                    await gmail.users.messages.modify({
                        userId: 'me',
                        id: msg.id,
                        requestBody: { removeLabelIds: ['UNREAD'] }
                    });
                } catch (readError) {
                    console.error(`Failed to mark email as read: ${readError}`);
                    debugLogs.push(`⚠️ Warning: Could not mark as read (Insufficient Scopes)`);
                }
            }

        } catch (err) {
            console.error(`Error processing msg ${msg.id}:`, err);
            results.push({ msgId: msg.id, error: String(err) });
        }
    }

    // Append debug logs to results for UI visibility
    if (results.length === 0 && debugLogs.length > 0) {
        results.push({ status: "info", logs: debugLogs });
    } else if (results.length > 0) {
        // Also append logs if we have results, so header info is visible
        results.unshift({ status: "info", logs: debugLogs });
    }

    return NextResponse.json({ 
        success: true, 
        processed: results.length,
        results: results // UI expects 'results'
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Email Scan API Error:", error);
    
    // Specifically handle OAuth2 'invalid_grant'
    if (error.message?.includes('invalid_grant') || error.code === 'invalid_grant') {
      return NextResponse.json({ 
        success: false,
        error: "Google Authentication Expired (invalid_grant). Please run 'node scripts/auth-gmail.js' in the project directory to re-authenticate." 
      }, { status: 401 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
