# IT-KPI

ระบบติดตามตัวชี้วัด (KPI) แผนกสารสนเทศ โรงพยาบาลศูนย์การแพทย์ มหาวิทยาลัยวลัยลักษณ์

หน้าเว็บ ITWUH KPI Tracker เก็บข้อมูลใน Google Sheet ผ่าน Google Apps Script ทีมทุกคนเห็นข้อมูลชุดเดียวกัน

**เปิดใช้งาน:** https://rainbow-wuh.github.io/IT-KPI/

## ไฟล์ในโปรเจกต์

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `apps-script/Code.gs` | ส่วนที่อ่านและเขียนข้อมูลลง Google Sheet |
| `docs/index.html` | หน้าเว็บ KPI Tracker (GitHub Pages เปิดจากไฟล์นี้ และใช้เป็นไฟล์ `index` ใน Apps Script ได้ด้วย) |
| `database/ITWUH_KPI_Database.xlsx` | แม่แบบฐานข้อมูล พร้อม KPI ตั้งต้น 27 ตัว ใช้นำเข้าเป็น Google Sheet |

## โครงสร้างฐานข้อมูล (แท็บใน Google Sheet)

| แท็บ | 1 แถว = | คีย์ |
|---|---|---|
| `kpi_master` | 1 ตัวชี้วัด | `kpi_id` |
| `kpi_owners` | ผู้รับผิดชอบ 1 คนต่อ 1 KPI | `kpi_id` + `owner_name` |
| `monthly_entries` | ผลการดำเนินงาน 1 KPI ต่อ 1 เดือน | `entry_id` เช่น `K07__2026-09` |
| `fiscal_months` | 1 เดือนในปีงบประมาณ (ต.ค.–ก.ย.) | `fm_key` เช่น `2569\|12` |
| `ref_group`, `ref_status`, `ref_metric_type`, `ref_target_direction` | รหัสอ้างอิงสำหรับ dropdown | รหัส |
| `summary` | สรุปผลด้วยสูตร เลือกปีงบประมาณที่ช่อง C3 | |
| `data_dictionary` | คำอธิบายทุกคอลัมน์ | |

ความสัมพันธ์: `kpi_master` 1 ตัว มีได้หลายแถวใน `kpi_owners` และ `monthly_entries` (เชื่อมด้วย `kpi_id`)

## วิธีติดตั้ง

1. อัปโหลด `database/ITWUH_KPI_Database.xlsx` ขึ้น Google Drive แล้วเปิดด้วย Google ชีต
2. ในชีต ไปที่ **ส่วนขยาย > Apps Script**
3. วางเนื้อหา `apps-script/Code.gs` แทนโค้ดเดิมในไฟล์ `Code.gs`
4. เพิ่มไฟล์ HTML ชื่อ `index` แล้ววางเนื้อหา `docs/index.html`
5. **ทำให้ใช้งานได้ > การทำให้ใช้งานได้รายการใหม่ > เว็บแอป**
   - ดำเนินการในฐานะ: ฉัน
   - ผู้มีสิทธิ์เข้าถึง: ทุกคน (ต้องเป็น "ทุกคน" หน้าเว็บบน GitHub Pages จึงเรียกใช้ได้)
6. ถ้า URL เว็บแอปเปลี่ยน ให้แก้ค่า `API_URL` ใน `docs/index.html` แล้ว push ขึ้น GitHub

## การอัปเดตโค้ด

แก้ไฟล์ใน Apps Script แล้วไปที่ **ทำให้ใช้งานได้ > จัดการการทำให้ใช้งานได้ > แก้ไข > เวอร์ชันใหม่** URL เดิมจะใช้ได้ต่อ ถ้าไม่สร้างเวอร์ชันใหม่ ผู้ใช้จะยังเห็นโค้ดเก่า

## ข้อควรรู้

- การลบตัวชี้วัดในหน้าเว็บ คือการตั้ง `is_active` เป็น FALSE ผลย้อนหลังยังอยู่ในชีต
- `count_value` เก็บจำนวนของเดือนนั้น ยอดสะสมคำนวณในแท็บ `summary`
- หน้าเว็บเปิดได้ 2 ทาง คือ GitHub Pages และ URL เว็บแอป Apps Script ทั้งสองทางบันทึกลงชีตเดียวกัน
- repo นี้เป็น public และ URL เว็บแอปอยู่ในโค้ด ใครมีลิงก์ก็บันทึกข้อมูลได้
