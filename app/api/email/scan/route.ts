import { NextResponse } from 'next/server';
import { getGmailClient } from '@/lib/gmailClient';
// force-rebuild
import { extractRollTagData } from '@/lib/emailParser';
import { writeRollTagData, PO_SPREADSHEET_ID } from '@/lib/googleSheets';

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

    // 1. List Emails (Detailed Search: Unread + Sender)
    // Legacy: is:unread from:formica.com has:attachment
    const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread from:formica.com', 
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

    let currentRollTagIndex = 1;

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
                 debugLogs.push(`Skipped [${subject}]: No attachments found.`);
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
                        
                        if (extractedCustomers.length > 0) {
                            for (const customerData of extractedCustomers) {
                                if (currentRollTagIndex > 2) {
                                    results.push({ msgId: msg.id, status: "skipped_full", customer: customerData.customerId });
                                    continue;
                                }

                                const targetSheet = `Roll Tag${currentRollTagIndex}`;
                                await writeRollTagData(PO_SPREADSHEET_ID, targetSheet, customerData);
                                
                                const successMsg = { 
                                    msgId: msg.id, 
                                    file: fileName, 
                                    customer: customerData.customerId,
                                    sheet: targetSheet,
                                    status: "success" 
                                };
                                results.push(successMsg);
                                debugLogs.push(`✅ Success: ${fileName} -> ${targetSheet}`);
                                
                                currentRollTagIndex++;
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
