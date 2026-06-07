# WMS 360 PRO Roadmap

เอกสารนี้เป็น backlog สำหรับต่อยอดระบบโดยไม่แตะ logic หน้า order/email โดยไม่จำเป็น

## Phase 1: Stability และ Developer Experience

- ทำให้ `npx tsc --noEmit` ผ่านเสมอใน app code
- เอา `typescript.ignoreBuildErrors` ออกจาก Next config
- เพิ่ม README และ env guide
- ปิด default auth secret และ default admin backdoor บน production
- เพิ่ม checklist ก่อน deploy

## Phase 2: Feature Foundation

- สร้าง Zod schema กลางสำหรับ product, transaction, damage, cycle count, user และ branch
- สร้าง response format กลางของ API: `{ success, data, error }`
- ทำ API helper กลางสำหรับ validation โดยยังไม่เปลี่ยน route ซับซ้อน
- ทำ data quality checklist สำหรับ duplicate SKU, missing location, negative stock, missing price และ stale movement

## Phase 3: Inventory Operations

- Cycle count workflow เต็มรูปแบบ: assign, count, variance, approve, audit
- Offline queue ให้รองรับ `INBOUND`, `OUTBOUND`, `DAMAGE`, `ADJUST`
- Stock reservation สำหรับงานที่รอจ่าย
- Lot/batch/expiry view สำหรับ FEFO
- Damage approval flow พร้อมเหตุผลและรูปแนบ

## Phase 4: Planning และ Automation

- Reorder suggestion workflow: AI suggestion -> manager approve -> PO draft
- Notification rule builder: low stock, deadstock, overdue cycle count, new job
- Dashboard drill-down จาก KPI ไปยัง transaction/source row
- Export Excel/CSV แบบมี filter และ validation preview

## Phase 5: Scale Readiness

- วางแผนย้าย transaction และ audit logs ไป database จริงเมื่อข้อมูลโต
- คง Google Sheets เป็น integration/import-export layer
- เพิ่ม automated tests สำหรับ inbound/outbound/products/reports
- เพิ่ม monitoring สำหรับ cron, push notification และ sync queue
