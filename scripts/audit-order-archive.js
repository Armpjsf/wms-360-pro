/**
 * ตรวจสุขภาพชีต "คลังข้อมูล" (สถานะงานออเดอร์)
 *
 *   node scripts/audit-order-archive.js            # อ่านอย่างเดียว พิมพ์รายงาน
 *   node scripts/audit-order-archive.js --fix      # ซ่อมเฉพาะที่ปลอดภัย (ดูด้านล่าง)
 *   node scripts/audit-order-archive.js --ssid=<spreadsheetId>
 *
 * --fix ทำแค่ 2 อย่าง:
 *   1. สถานะ "กำลังแก้ไข" (ค้างจาก recall แบบเก่า -> ไม่มีหน้าไหนแสดง) -> "กำลังดำเนินการ"
 *   2. ลบแถวว่างทั้งแถวที่คั่นอยู่ระหว่างข้อมูล (สาเหตุที่ append ไปเขียนทับแถวอื่น)
 * แถวที่ข้อมูลเลื่อนคอลัมน์ / ซ้ำ / สถานะปนกัน จะรายงานอย่างเดียว ให้คนตรวจเอง
 *
 * Credentials: GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY จาก .env.local หรือ service-key.json
 */
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const DATA_SHEET = 'คลังข้อมูล';
const FORM_SHEET = 'ส่งสินค้า';
const KNOWN_STATUSES = ['กำลังดำเนินการ', 'รอลูกค้า', 'เสร็จสิ้น', 'กำลังแก้ไข', 'รอ PDF'];

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

async function getSheets() {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const auth = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY
    ? new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
        scopes,
      })
    : new google.auth.GoogleAuth({ keyFile: path.join(process.cwd(), 'service-key.json'), scopes });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

const cell = (row, i) => String((row && row[i]) ?? '').trim();
const isBlank = (row) => !row || row.every((v) => String(v ?? '').trim() === '');

async function main() {
  loadEnvLocal();
  const fix = process.argv.includes('--fix');
  const ssidArg = process.argv.find((a) => a.startsWith('--ssid='));
  const ssid = (ssidArg && ssidArg.split('=')[1])
    || (process.env.PRODUCT_SPREADSHEET_ID || '').trim()
    || '1nIIVyTTtu4VAmDZgPh8lsnAyUEgqvp2EzmO9Y1MOQWM';

  const sheets = await getSheets();
  const [dataRes, formRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: ssid, range: `'${DATA_SHEET}'!A:Z` }),
    sheets.spreadsheets.values.get({ spreadsheetId: ssid, range: `'${FORM_SHEET}'!G3` }),
  ]);
  const data = dataRes.data.values || [];
  const onForm = cell(formRes.data.values?.[0], 0);

  // หาแถวข้อมูลแถวสุดท้าย (ไม่นับแถวว่างท้ายชีต)
  let lastDataIdx = 0;
  data.forEach((r, i) => { if (!isBlank(r)) lastDataIdx = i; });

  const blankRows = [];        // แถวว่างคั่น (1-based)
  const shiftedRows = [];      // มีข้อมูลเลยคอลัมน์ I (J+) = append เพี้ยนคอลัมน์
  const noDocRows = [];        // มีข้อมูลแต่ A ว่าง
  const unknownStatus = [];
  const editingDocs = new Map(); // docNum -> [rows] สถานะ กำลังแก้ไข
  const docs = new Map();        // docNum -> { rows, statuses:Set, seqs:Map }

  for (let i = 1; i <= lastDataIdx; i++) {
    const row = data[i];
    const rowNo = i + 1;
    if (isBlank(row)) { blankRows.push(rowNo); continue; }
    if (row.length > 9 && row.slice(9).some((v) => String(v ?? '').trim() !== '')) {
      shiftedRows.push({ rowNo, preview: row.slice(0, 14).map((v) => String(v ?? '')).join(' | ') });
    }
    const docNum = cell(row, 0);
    if (!docNum) { noDocRows.push({ rowNo, preview: row.slice(0, 9).join(' | ') }); continue; }

    const status = cell(row, 6);
    if (status && !KNOWN_STATUSES.includes(status)) unknownStatus.push({ rowNo, docNum, status });
    if (status === 'กำลังแก้ไข') {
      if (!editingDocs.has(docNum)) editingDocs.set(docNum, []);
      editingDocs.get(docNum).push(rowNo);
    }

    if (!docs.has(docNum)) docs.set(docNum, { rows: [], statuses: new Set(), seqs: new Map(), customer: cell(row, 1) });
    const d = docs.get(docNum);
    d.rows.push(rowNo);
    d.statuses.add(status || '(ว่าง)');
    const key = `${cell(row, 2)}|${cell(row, 4)}`;
    d.seqs.set(key, (d.seqs.get(key) || 0) + 1);
  }

  const mixedStatus = [];
  const duplicates = [];
  const scattered = [];
  for (const [docNum, d] of docs) {
    if (d.statuses.size > 1) mixedStatus.push({ docNum, statuses: [...d.statuses].join(', '), rows: d.rows.join(',') });
    const dup = [...d.seqs.entries()].filter(([, n]) => n > 1);
    if (dup.length) duplicates.push({ docNum, dup: dup.map(([k, n]) => `${k} x${n}`).join('; ') });
    const span = d.rows[d.rows.length - 1] - d.rows[0] + 1;
    if (span > d.rows.length + 5) scattered.push({ docNum, rows: d.rows.join(',') });
  }

  const openDocs = [...docs.entries()].filter(([, d]) => [...d.statuses].some((s) => s !== 'เสร็จสิ้น'));

  console.log(`\n=== ตรวจ ${DATA_SHEET} (spreadsheet ${ssid}) ===`);
  console.log(`แถวข้อมูลถึงแถว: ${lastDataIdx + 1} | เอกสาร: ${docs.size} | ยังไม่ปิด: ${openDocs.length} | งานบนฟอร์ม (G3): ${onForm || '-'}`);
  if (onForm && !docs.has(onForm)) console.log(`⚠️  งานบนฟอร์ม ${onForm} ไม่มีในคลังข้อมูล`);

  const section = (title, list, fmt) => {
    console.log(`\n[${list.length}] ${title}`);
    list.slice(0, 50).forEach((x) => console.log('   ' + fmt(x)));
    if (list.length > 50) console.log(`   ... อีก ${list.length - 50}`);
  };
  section('แถวว่างคั่นระหว่างข้อมูล (ทำให้ append เขียนทับ)', blankRows, (r) => `row ${r}`);
  section('สถานะ "กำลังแก้ไข" (หน้าเว็บ/มือถือเดิมไม่แสดง = งานหาย)', [...editingDocs.entries()], ([d, rows]) => `${d}  (${docs.get(d)?.customer || ''}) rows ${rows.join(',')}`);
  section('ข้อมูลเลยคอลัมน์ I (เลื่อนคอลัมน์ — ตรวจเอง)', shiftedRows, (x) => `row ${x.rowNo}: ${x.preview}`);
  section('มีข้อมูลแต่ไม่มีเลขเอกสาร (A ว่าง) — ตรวจเอง', noDocRows, (x) => `row ${x.rowNo}: ${x.preview}`);
  section('เอกสารเดียวแต่สถานะไม่ตรงกันทุกแถว — ตรวจเอง', mixedStatus, (x) => `${x.docNum}: ${x.statuses} (rows ${x.rows})`);
  section('รายการซ้ำในเอกสารเดียวกัน (seq+item ซ้ำ) — ตรวจเอง', duplicates, (x) => `${x.docNum}: ${x.dup}`);
  section('แถวของเอกสารกระจายห่างกัน (อาจถูกเขียนแทรก/ทับ) — ตรวจเอง', scattered, (x) => `${x.docNum}: rows ${x.rows}`);
  section('สถานะที่ไม่รู้จัก', unknownStatus, (x) => `row ${x.rowNo} ${x.docNum}: "${x.status}"`);

  if (!fix) {
    console.log('\n(อ่านอย่างเดียว — ใส่ --fix เพื่อแก้ "กำลังแก้ไข" และลบแถวว่างคั่น)\n');
    return;
  }

  // --- FIX 1: กำลังแก้ไข -> กำลังดำเนินการ (ก่อนลบแถว เพราะเลขแถวยังไม่เลื่อน)
  const editingRows = [...editingDocs.values()].flat();
  if (editingRows.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ssid,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: editingRows.map((r) => ({ range: `'${DATA_SHEET}'!G${r}`, values: [['กำลังดำเนินการ']] })),
      },
    });
    console.log(`✅ เปลี่ยน "กำลังแก้ไข" -> "กำลังดำเนินการ" ${editingRows.length} แถว (${editingDocs.size} เอกสาร)`);
  }

  // --- FIX 2: ลบแถวว่างคั่น (จากล่างขึ้นบน)
  if (blankRows.length) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: ssid, fields: 'sheets(properties(sheetId,title))' });
    const sheetId = meta.data.sheets.find((s) => s.properties.title === DATA_SHEET).properties.sheetId;
    const desc = [...blankRows].sort((a, b) => b - a);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ssid,
      requestBody: {
        requests: desc.map((r) => ({
          deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: r - 1, endIndex: r } },
        })),
      },
    });
    console.log(`✅ ลบแถวว่างคั่น ${blankRows.length} แถว`);
  }
  console.log('');
}

main().catch((e) => { console.error('❌', e.message || e); process.exit(1); });
