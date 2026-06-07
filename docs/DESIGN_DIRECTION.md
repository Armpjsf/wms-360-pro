# WMS 360 PRO Design Direction

เป้าหมายคือสร้างระบบ WMS ที่ดูพรีเมี่ยม น่าใช้ และมีบุคลิกเฉพาะของงานคลังสินค้า ไม่ใช่หน้าตา dashboard generic ที่เหมือน AI-generated template

## Design Principles

- Operational premium: สวยแต่ต้องอ่านเร็ว ใช้งานซ้ำได้ทั้งวัน และไม่รบกวนงานหน้างาน
- Color has meaning: ใช้สีเพื่อแยกประเภทงาน เช่น inbound, outbound, damage, analytics, admin ไม่ใช้สีเป็น decoration ลอย ๆ
- Dense but calm: ข้อมูลเยอะได้ แต่ต้องจัด hierarchy ชัด ไม่อัดจนเหนื่อย
- Route complete: เมนูหลักและหน้าย่อยต้องครบตามระบบเดิม
- Logic safe: ไม่แก้ business logic โดยไม่จำเป็น โดยเฉพาะ order/email/document flow

## Visual Language

- Base surface: warm slate / soft blue-gray แทนขาวล้วน
- Primary action: cobalt / royal blue
- Success and inbound: emerald / teal
- Outbound and movement: amber / orange
- Damage and risk: rose / red
- Analytics: violet เฉพาะ accent ไม่ครอบทั้งระบบ
- Admin/system: graphite / steel

## Avoid

- ห้ามทำโทนขาวดำล้วน
- ห้ามทำ palette สีเดียวทั้งระบบ
- หลีกเลี่ยง purple gradient หนัก ๆ แบบ SaaS template ทั่วไป
- หลีกเลี่ยง card ซ้อน card และ hero section ที่ไม่เกี่ยวกับงาน
- หลีกเลี่ยง decorative blobs/orbs
- ไม่ใช้ emoji เป็นไอคอน UI

## Component Tone

- Sidebar: สี accent ตามกลุ่มงาน พร้อม active state ที่ชัด
- Dashboard: KPI ต้องมี priority และ severity ไม่ใช่การ์ดเท่ากันหมด
- Tables: sticky headers, row density, readable contrast, clear row actions
- Forms: labels ชัด, validation ชัด, action buttons อยู่ตำแหน่งคาดเดาได้
- Mobile: ปุ่มใหญ่พอสำหรับหน้างาน warehouse และไม่ซ่อน action สำคัญ
