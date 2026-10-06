/**
 * ITWUH KPI Tracker · ส่วนเชื่อมต่อ Google Sheet
 * วางไฟล์นี้ใน Apps Script ที่ผูกกับชีต ITWUH_KPI_Database (ส่วนขยาย > Apps Script)
 * คู่กับไฟล์ HTML ชื่อ index
 */

var TZ = 'Asia/Bangkok';
var T_KPI = 'kpi_master';
var T_OWN = 'kpi_owners';
var T_ENT = 'monthly_entries';
var T_FM = 'fiscal_months';
var VALID_STATUS = ['not_started', 'in_progress', 'done', 'delayed'];
var TH_MONTH = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.'];
var Q_LABEL = {1: 'Q1 (ต.ค.–ธ.ค.)', 2: 'Q2 (ม.ค.–มี.ค.)', 3: 'Q3 (เม.ย.–มิ.ย.)', 4: 'Q4 (ก.ค.–ก.ย.)'};

/* ---------- เปิดหน้าเว็บ ---------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var name = p.api;
  if (name) {
    // callback = โหมดสำรอง (JSONP) หน้าเว็บโหลดผลลัพธ์แบบไฟล์สคริปต์ ใช้เมื่อเบราว์เซอร์บล็อกการเรียกข้ามเว็บ
    var cb = p.callback && /^[A-Za-z_$][\w$]*$/.test(p.callback) ? p.callback : null;
    var out;
    try {
      var fn = cb ? API_FUNCTIONS[name] : GET_FUNCTIONS[name];
      if (!fn) throw new Error('คำสั่งนี้เรียกผ่าน GET ไม่ได้: ' + name);
      var arg = p.arg ? JSON.parse(p.arg) : null;
      out = {ok: true, result: fn(arg)};
    } catch (err) {
      out = {ok: false, error: String((err && err.message) || err)};
    }
    if (cb) {
      return ContentService.createTextOutput(cb + '(' + JSON.stringify(out) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return json_(out);
  }
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ITWUH KPI Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ---------- รับคำสั่งจากหน้าเว็บที่อยู่นอก Apps Script (เช่น GitHub Pages) ---------- */
// หน้าเว็บส่ง POST แบบ text/plain มาเป็น {"fn": "ชื่อฟังก์ชัน", "arg": ข้อมูล}
// เรียกได้เฉพาะฟังก์ชันในรายการนี้เท่านั้น
var API_VERSION = '2026-10-06b';

// ใช้ตรวจว่าเว็บแอปรันโค้ดเวอร์ชันไหน และผูกกับชีตไหน
function ping() {
  return {version: API_VERSION, sheet: SpreadsheetApp.getActive().getName(), time: now_()};
}

// คำสั่งที่เรียกผ่าน GET ได้ (อ่านอย่างเดียว) เช่น .../exec?api=ping
var GET_FUNCTIONS = {ping: ping, getAllData: getAllData};

function json_(out) {
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

var API_FUNCTIONS = {
  ping: ping,
  getAllData: getAllData,
  saveEntry: saveEntry,
  saveKpi: saveKpi,
  deactivateKpi: deactivateKpi,
  addFiscalYear: addFiscalYear
};

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var fn = API_FUNCTIONS[req.fn];
    if (!fn) throw new Error('ไม่รู้จักคำสั่ง: ' + req.fn);
    out = {ok: true, result: fn(req.arg)};
  } catch (err) {
    out = {ok: false, error: String((err && err.message) || err)};
  }
  return json_(out);
}

/* ---------- ตัวช่วย ---------- */
function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('ไม่พบแท็บ "' + name + '" ในชีต');
  return sh;
}

// อ่านตารางทั้งแท็บ คืนค่า {head, raw, disp} โดยตัดแถวหัวตารางออก
function read_(name) {
  var sh = sheet_(name);
  var rng = sh.getDataRange();
  var raw = rng.getValues();
  var disp = rng.getDisplayValues();
  var head = raw.shift().map(String);
  disp.shift();
  return {sheet: sh, head: head, raw: raw, disp: disp};
}

function col_(t, name) {
  var i = t.head.indexOf(name);
  if (i === -1) throw new Error('แท็บ ' + t.sheet.getName() + ' ไม่มีคอลัมน์ ' + name);
  return i;
}

// หาเลขแถวในชีต (เริ่ม 2) จากค่าในคอลัมน์แรก ไม่พบคืน -1
function findRow_(sh, key) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var keys = sh.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (var i = 0; i < keys.length; i++) {
    if (keys[i][0] === key) return i + 2;
  }
  return -1;
}

function now_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss');
}

// แปลงเวลาที่เก็บในชีต "yyyy-MM-dd HH:mm(:ss)" เป็น ISO ที่เบราว์เซอร์อ่านได้
function toIso_(s) {
  var m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?$/);
  if (!m) return s || '';
  return m[1] + 'T' + m[2] + (m[3] || ':00') + '+07:00';
}

function num_(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

// เขียนทั้งแถว โดยกำหนดรูปแบบข้อความ (@) ให้คอลัมน์ข้อความก่อน เพื่อไม่ให้ชีตแปลง "88%" หรือ "2026-09" เป็นตัวเลข/วันที่
function writeRow_(sh, row, values, textCols) {
  var rng = sh.getRange(row, 1, 1, values.length);
  var formats = values.map(function (_, i) { return textCols.indexOf(i) !== -1 ? '@' : 'General'; });
  rng.setNumberFormats([formats]);
  rng.setValues([values]);
}

// คำนวณปีงบประมาณจาก month_key แบบ ค.ศ. เช่น "2026-09" -> {fy:2569, no:12, q:4}
function fiscalOf_(monthKey) {
  var m = String(monthKey).match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new Error('รูปแบบเดือนไม่ถูกต้อง: ' + monthKey);
  var y = Number(m[1]), mo = Number(m[2]);
  var fy = y + 543 + (mo >= 10 ? 1 : 0);
  var no = mo >= 10 ? mo - 9 : mo + 3;
  return {fy: fy, no: no, q: Math.ceil(no / 3)};
}

/* ---------- โหลดข้อมูลทั้งหมด ---------- */
function getAllData() {
  // KPI ที่ยังใช้งาน
  var k = read_(T_KPI);
  var c = {};
  ['kpi_id', 'kpi_no', 'group_code', 'category', 'owner_text', 'task_name', 'kpi_name', 'metric_type',
   'target_text', 'target_num', 'target_unit', 'target_direction', 'activity_note', 'is_active']
    .forEach(function (h) { c[h] = col_(k, h); });
  var kpis = [];
  k.raw.forEach(function (r, i) {
    var d = k.disp[i];
    if (!d[c.kpi_id]) return;
    if (r[c.is_active] === false || String(r[c.is_active]).toUpperCase() === 'FALSE') return;
    var no = d[c.kpi_no];
    var obj = {
      id: d[c.kpi_id],
      no: /^\d+$/.test(no) ? Number(no) : no,
      group: d[c.group_code],
      category: d[c.category] || null,
      owner: d[c.owner_text] || 'ไม่ระบุ',
      task: d[c.task_name],
      kpi: d[c.kpi_name],
      target: d[c.target_text] || '-',
      metricType: d[c.metric_type] || 'other',
      targetUnit: d[c.target_unit] || '',
      cmp: d[c.target_direction] || null,
      note: d[c.activity_note]
    };
    var tn = num_(r[c.target_num]);
    if (tn !== null) obj.targetNum = tn;
    kpis.push(obj);
  });

  // ผลรายเดือน
  var e = read_(T_ENT);
  var ec = {};
  ['kpi_id', 'month_key', 'status_code', 'actual_value', 'count_value', 'activity_detail', 'note', 'updated_by', 'updated_at']
    .forEach(function (h) { ec[h] = col_(e, h); });
  var entries = [];
  e.raw.forEach(function (r, i) {
    var d = e.disp[i];
    if (!d[ec.kpi_id] || !d[ec.month_key]) return;
    entries.push({
      kpiId: d[ec.kpi_id],
      monthKey: d[ec.month_key],
      status: d[ec.status_code] || 'not_started',
      actual: d[ec.actual_value],
      count: num_(r[ec.count_value]),
      detail: d[ec.activity_detail],
      note: d[ec.note],
      updatedBy: d[ec.updated_by],
      updatedAt: toIso_(d[ec.updated_at])
    });
  });

  // ปีงบประมาณที่มีในปฏิทิน
  var f = read_(T_FM);
  var fyCol = col_(f, 'fiscal_year');
  var years = [];
  f.raw.forEach(function (r) {
    var y = num_(r[fyCol]);
    if (y && years.indexOf(y) === -1) years.push(y);
  });

  return {kpis: kpis, entries: entries, fiscalYears: years.sort()};
}

/* ---------- บันทึกผลรายเดือน (เพิ่มใหม่หรือแก้ทับเดือนเดิม) ---------- */
function saveEntry(p) {
  if (!p || !p.kpiId || !p.monthKey) throw new Error('ข้อมูลไม่ครบ');
  if (VALID_STATUS.indexOf(p.status) === -1) throw new Error('สถานะไม่ถูกต้อง: ' + p.status);
  var fis = fiscalOf_(p.monthKey);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(T_ENT);
    var id = p.kpiId + '__' + p.monthKey;
    var row = findRow_(sh, id);
    if (row === -1) row = sh.getLastRow() + 1;
    var ts = now_();
    var by = String(p.updatedBy || 'ไม่ระบุชื่อ');
    var count = (p.count === null || p.count === undefined || p.count === '') ? '' : Number(p.count);
    // entry_id, kpi_id, fiscal_year, month_key, fiscal_month_no, quarter, status_code,
    // actual_value, count_value, activity_detail, note, updated_by, updated_at
    writeRow_(sh, row, [id, p.kpiId, fis.fy, p.monthKey, fis.no, fis.q, p.status,
      p.actual || '', count, p.detail || '', p.note || '', by, ts], [0, 1, 3, 6, 7, 9, 10, 11, 12]);
    SpreadsheetApp.flush();
    return {kpiId: p.kpiId, monthKey: p.monthKey, status: p.status, actual: p.actual || '',
      count: count === '' ? null : count, detail: p.detail || '', note: p.note || '',
      updatedBy: by, updatedAt: toIso_(ts)};
  } finally {
    lock.releaseLock();
  }
}

/* ---------- เพิ่ม / แก้ไขตัวชี้วัด ---------- */
function saveKpi(k) {
  if (!k || !k.task) throw new Error('กรุณาระบุชื่องาน');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(T_KPI);
    var id = k.id;
    if (!id) {
      // ออกรหัสใหม่ต่อจากเลขสูงสุด เช่น K27 -> K28
      var maxN = 0;
      var last = sh.getLastRow();
      if (last >= 2) {
        sh.getRange(2, 1, last - 1, 1).getDisplayValues().forEach(function (r) {
          var m = String(r[0]).match(/^K(\d+)$/);
          if (m) maxN = Math.max(maxN, Number(m[1]));
        });
      }
      id = 'K' + ('0' + (maxN + 1)).slice(-2);
    }
    var row = findRow_(sh, id);
    var ts = now_();
    var created = ts.slice(0, 10);
    if (row === -1) {
      row = sh.getLastRow() + 1;
    } else {
      created = sh.getRange(row, 15).getDisplayValue() || created;
    }
    var isCount = k.metricType === 'count';
    // kpi_id, kpi_no, group_code, category, owner_text, task_name, kpi_name, metric_type, target_text,
    // target_num, target_unit, target_direction, activity_note, is_active, created_at, updated_at
    writeRow_(sh, row, [id, String(k.no == null ? '' : k.no), k.group, k.category || '', k.owner || 'ไม่ระบุ',
      k.task, k.kpi || '', k.metricType || 'other', k.target || '-',
      isCount && k.targetNum !== null ? Number(k.targetNum) : '', isCount ? (k.targetUnit || '') : '',
      isCount ? (k.cmp || 'gte') : '', k.note || '', true, created, ts.slice(0, 10)],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 14, 15]);

    // เขียนผู้รับผิดชอบใหม่ใน kpi_owners (ลบของเดิมของ KPI นี้ก่อน)
    var own = sheet_(T_OWN);
    var lastO = own.getLastRow();
    if (lastO >= 2) {
      var ids = own.getRange(2, 1, lastO - 1, 1).getDisplayValues();
      for (var i = ids.length - 1; i >= 0; i--) {
        if (ids[i][0] === id) own.deleteRow(i + 2);
      }
    }
    String(k.owner || '').split(',').map(function (s) { return s.trim(); }).filter(String)
      .forEach(function (name) {
        writeRow_(own, own.getLastRow() + 1, [id, name], [0, 1]);
      });
    SpreadsheetApp.flush();

    var out = {id: id, no: k.no, group: k.group, category: k.category || null, owner: k.owner || 'ไม่ระบุ',
      task: k.task, kpi: k.kpi || '', target: k.target || '-', metricType: k.metricType || 'other',
      targetUnit: isCount ? (k.targetUnit || '') : '', cmp: isCount ? (k.cmp || 'gte') : null, note: k.note || ''};
    if (isCount && k.targetNum !== null) out.targetNum = Number(k.targetNum);
    return out;
  } finally {
    lock.releaseLock();
  }
}

/* ---------- ลบตัวชี้วัด = ตั้ง is_active เป็น FALSE (เก็บผลย้อนหลังไว้) ---------- */
function deactivateKpi(id) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(T_KPI);
    var row = findRow_(sh, id);
    if (row === -1) throw new Error('ไม่พบตัวชี้วัด ' + id);
    sh.getRange(row, 14).setValue(false);
    sh.getRange(row, 16).setNumberFormat('@').setValue(now_().slice(0, 10));
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* ---------- เพิ่มปีงบประมาณใหม่ใน fiscal_months (12 เดือน) ---------- */
function addFiscalYear(be) {
  be = Number(be);
  if (!be || be < 2500 || be > 2700) throw new Error('ปี พ.ศ. ไม่ถูกต้อง');
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_(T_FM);
    if (findRow_(sh, be + '|01') !== -1) return true;
    var ceEnd = be - 543;
    for (var i = 0; i < 12; i++) {
      var y = i < 3 ? ceEnd - 1 : ceEnd;
      var mo = i < 3 ? 10 + i : i - 2;
      var labBe = i < 3 ? be - 1 : be;
      var q = Math.floor(i / 3) + 1;
      var no = ('0' + (i + 1)).slice(-2);
      var mk = y + '-' + ('0' + mo).slice(-2);
      var row = sh.getLastRow() + 1;
      // fm_key, fiscal_year, fiscal_month_no, month_key, month_label, quarter, quarter_label, month_start
      writeRow_(sh, row, [be + '|' + no, be, i + 1, mk, TH_MONTH[i] + ' ' + ('0' + (labBe % 100)).slice(-2),
        q, Q_LABEL[q], new Date(y, mo - 1, 1)], [0, 3, 4, 6]);
      sh.getRange(row, 8).setNumberFormat('yyyy-mm-dd');
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}
