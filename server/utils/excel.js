import ExcelJS from 'exceljs';
import { selectDataFields } from './formFieldUtils.js';

// Build field columns array from form
function buildFieldColumns(form) {
  // Header now only shows the human-readable label (or falls back to id) — field IDs removed
  // per requirement: do not expose internal field ids in the 模板 sheet header row.
  return selectDataFields(form.fields).map(f => ({
    header: (f.properties && f.properties.label) || f.id,
    key: f.id,
    width: 20,
  }));
}

// Apply Excel autoFilter safely
function applyAutoFilter(sheet) {
  const headerRow = sheet.getRow(1);
  const colCount = headerRow.cellCount;
  if (colCount > 0) {
    const toLetters = (num) => { let s=''; while(num>0){ const mod=(num-1)%26; s=String.fromCharCode(65+mod)+s; num=Math.floor((num-mod)/26);} return s; };
    const lastColLetter = toLetters(colCount);
    sheet.autoFilter = { from: 'A1', to: `${lastColLetter}1` };
  }
}

// Build meta (字段说明) sheet
function buildMetaSheet(workbook, form, dynamicOptionsMap = {}) {
  const metaSheet = workbook.addWorksheet('字段说明');
  metaSheet.columns = [
    { header: '字段ID', key: 'id', width: 24 },
    { header: '标签', key: 'label', width: 28 },
    { header: '类型', key: 'type', width: 16 },
    { header: '必填', key: 'required', width: 10 },
    { header: '校验规则', key: 'rules', width: 40 },
    { header: '可选项', key: 'options', width: 60 },
    { header: '备注', key: 'note', width: 40 },
  ];
  selectDataFields(form.fields).forEach(f => {
    const props = f.properties || {};
    const required = f.validation?.required === true;
    const rulesDesc = Array.isArray(props.rules) ? props.rules.map(r => {
      const parts = [];
      if (r.required) parts.push('required');
      if (r.min) parts.push(`min:${r.min}`);
      if (r.max) parts.push(`max:${r.max}`);
      if (r.pattern) parts.push(`pattern:${r.pattern}`);
      return parts.join('|');
    }).join('; ') : '';
    let optionsDesc = '';
    console.log(`Processing field ${f.id} of type ${f.type} for meta sheet`, props);
    if (['radio-group','checkbox-group','dropdown','dropdown-checkbox'].includes(f.type)) {
      const isDynamic = props.optionsSource?.mode === 'formColumn';
      const staticOpts = Array.isArray(props.options) ? props.options : [];
      if (isDynamic) {
        console.log(`Building options description for dynamic field ${f.id}`);
        const dyn = Array.isArray(dynamicOptionsMap[f.id]) ? dynamicOptionsMap[f.id] : [];
        if (dyn.length) {
          optionsDesc = `动态来源: ${props.optionsSource.formId || ''}.${props.optionsSource.fieldId || ''}\n` + dyn.map(o => `${o.value}:${o.label}`).join('\n');
        } else {
          optionsDesc = `动态来源: ${props.optionsSource.formId || ''}.${props.optionsSource.fieldId || ''}`;
        }
      } else{
        optionsDesc = staticOpts.map(o => `${o.value}:${o.label}`).join('\n');
      } 
    }
    metaSheet.addRow({
      id: f.id,
      label: props.label || f.id,
      type: f.type,
      required: required ? '是' : '否',
      rules: rulesDesc,
      options: optionsDesc,
      note: props.placeholder || '',
    });
  });
  metaSheet.getRow(1).font = { bold: true };
  applyAutoFilter(metaSheet);
  return metaSheet;
}

// Create workbook and common properties
function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ainote-platform';
  workbook.created = new Date();
  return workbook;
}

// Build template sheet (with or without data)
function buildTemplateSheet(workbook, form, records, options = {}) {
  const { includeData = false } = options;
  const templateSheet = workbook.addWorksheet('模板');
  const dataFields = selectDataFields(form.fields);
  const fieldColumns = buildFieldColumns(form);
  templateSheet.columns = fieldColumns;
  templateSheet.getRow(1).font = { bold: true };
  if (includeData && Array.isArray(records)) {
    records.forEach(r => {
      const rowObj = {};
      dataFields.forEach(f => {
        let val = r.data[f.id];
        if (val === undefined || val === null) val = '';
        // Export formatting per type
        if (Array.isArray(val)) {
          if (['checkbox-group','dropdown-checkbox'].includes(f.type)) {
            // Map values to labels if possible
            const opts = Array.isArray(f.properties?.options) ? f.properties.options : [];
            const mapped = val.map(v => {
              const found = opts.find(o => o.value === v);
              return found ? found.label : v;
            });
            val = mapped.join('|');
          } else if (['image','attachment'].includes(f.type)) {
            // Expect array of objects {url,name}; export URLs joined by |
            const urls = val.map(v => (v && v.url) ? v.url : (typeof v === 'string' ? v : '')).filter(u => u);
            val = urls.join('|');
          } else {
            val = val.join('|');
          }
        } else {
          // Single value cases for select/radio: map to label
          if (['radio-group','dropdown'].includes(f.type) && val) {
            const opts = Array.isArray(f.properties?.options) ? f.properties.options : [];
            const found = opts.find(o => o.value === val);
            if (found) val = found.label;
          }
          if (['image','attachment'].includes(f.type) && val && typeof val === 'object') {
            val = val.url || '';
          }
        }
        if (f.type === 'date-picker' && val) {
          // Prevent timezone-induced day shift by writing an Excel serial number instead of JS Date
          // Accept either ISO string or YYYY-MM-DD; derive local date components
          let y, m, d;
          if (typeof val === 'string') {
            const dateStrMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (dateStrMatch) {
              y = parseInt(dateStrMatch[1], 10);
              m = parseInt(dateStrMatch[2], 10) - 1;
              d = parseInt(dateStrMatch[3], 10);
            } else {
              const dt = new Date(val);
              if (!isNaN(dt.getTime())) {
                y = dt.getFullYear();
                m = dt.getMonth();
                d = dt.getDate();
              }
            }
          } else if (val instanceof Date && !isNaN(val.getTime())) {
            y = val.getFullYear(); m = val.getMonth(); d = val.getDate();
          }
          if (y !== undefined) {
            // Compute Excel 1900-date-system serial (account for Excel's 1900 leap year bug)
            const epochUTC = Date.UTC(y, m, d);
            const excelEpochUTC = Date.UTC(1899, 11, 30); // Excel day 1 = 1900-01-01
            let serial = Math.round((epochUTC - excelEpochUTC) / 86400000);
            // Adjust for Excel's fictitious 1900-02-29 (dates >= 1900-03-01 need +1)
            if (epochUTC >= Date.UTC(1900, 2, 1)) serial += 1;
            rowObj[f.id] = serial; // number; will apply date numFmt later
          } else {
            rowObj[f.id] = val; // fallback raw string
          }
        } else {
          rowObj[f.id] = val;
        }
      });
      const newRow = templateSheet.addRow(rowObj);
      // Apply date format style: yyyy-MM-dd
      dataFields.forEach((f, idx) => {
        if (f.type === 'date-picker') {
          const cell = newRow.getCell(idx + 1);
          if (cell.value !== null && cell.value !== '' && typeof cell.value === 'number') {
            cell.numFmt = 'yyyy-mm-dd';
          }
        }
      });
    });
  }
  applyAutoFilter(templateSheet);
  return templateSheet;
}

// Generate a safe filename base
function buildSafeBase(form) {
  const baseName = (form.name || form.properties?.name || 'data');
  return baseName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5-_ ]/g, '').trim().replace(/\s+/g, '_').slice(0,60) || 'data';
}

// Build final filename
function buildFilename(form, kind) {
//   const safeBase = buildSafeBase(form);
//   const timestamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'');
//   return `${safeBase}-${kind}-${timestamp}.xlsx`.replace(/"/g,'');
    return "data.xlsx"
}

export {
  buildFieldColumns,
  applyAutoFilter,
  buildMetaSheet,
  createWorkbook,
  buildTemplateSheet,
  buildFilename,
  buildSafeBase,
};
