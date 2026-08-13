/* ==========================================================================
   KIKES PREOPERACIONAL - Core Logic & Data Controller
   ========================================================================== */

// --- 1. Checklist Items Definition ---
const CHECKLIST_STRUCTURE = [
  {
    category: "EQUIPAMIENTO",
    items: [
      { id: "eq_propiedad", text: "Tarjeta de Propiedad" },
      { id: "eq_soat", text: "SOAT" },
      { id: "eq_tecnomec", text: "Certificado de revisión técnico-mecánica" },
      { id: "eq_chaleco", text: "Chaleco" },
      { id: "eq_casco", text: "Casco" }
    ]
  },
  {
    category: "RUEDAS",
    items: [
      { id: "ru_delantera_estado", text: "Delantera (Estado)" },
      { id: "ru_delantera_libre", text: "Delantera gira libre sin ruidos anormales" },
      { id: "ru_trasera_estado", text: "Trasera (Estado)" },
      { id: "ru_trasera_libre", text: "Trasera gira libre sin ruidos anormales" },
      { id: "ru_motocarguero_llantas", text: "Estado de las llantas traseras (Aplica motocargueros)", onlyMotocarga: true }
    ]
  },
  {
    category: "EXTERIOR DEL VEHÍCULO",
    items: [
      { id: "ex_espejos", text: "Estado y ubicación de espejos retrovisores" },
      { id: "ex_direccionales", text: "Funcionamiento luces direccionales" },
      { id: "ex_luces_altas_bajas", text: "Funcionamiento luces altas y bajas" },
      { id: "ex_luces_stop", text: "Funcionamiento luces stop" },
      { id: "ex_indicadores_tablero_1", text: "Funcionamiento de los indicadores del tablero" },
      { id: "ex_pito", text: "Funcionamiento del pito" },
      { id: "ex_externo_flojo", text: "Ninguna parte externa floja, suelta o en riesgo de caerse" },
      { id: "ex_asiento", text: "Asiento y tapizado sin cortes, rasgaduras o roturas" },
      { id: "ex_manubrio", text: "Manubrio y mangos en buen estado" },
      { id: "ex_indicadores_tablero_2", text: "Funcionamiento de indicadores del tablero" },
      { id: "ex_motocarguero_carpa", text: "Estado de la carpa y el chasis (Aplica motocarguero)", onlyMotocarga: true }
    ]
  },
  {
    category: "INSPECCIÓN MECÁNICA",
    items: [
      { id: "me_freno_delantero", text: "Freno delantero" },
      { id: "me_freno_trasero", text: "Freno trasero" },
      { id: "me_tapas", text: "Tapas (combustible, agua, aceite, frenos)" },
      { id: "me_ruidos_motor", text: "No presenta ruidos anormales en motor, caja o escape" },
      { id: "me_fugas_combustible", text: "No presenta fugas de combustible, aceite o líquido de frenos" },
      { id: "me_fugas_amortiguadores", text: "No presenta fugas de aceite en amortiguadores delanteros" },
      { id: "me_nivel_frenos", text: "Nivel de líquido de frenos" },
      { id: "me_cadena_tension", text: "Cadena con tensión adecuada" },
      { id: "me_humo_escape", text: "No emite humo visible por el escape (Azul, blanco o negro)" }
    ]
  },
  {
    category: "CONDICIONES DEL CONDUCTOR",
    items: [
      { id: "co_estado_fisico", text: "Estado físico adecuado (sin fatiga, mareo, fiebre, sueño u otros síntomas)" },
      { id: "co_no_alcohol", text: "No consumo de alcohol, medicamentos o SPA" },
      { id: "co_licencia_vigente", text: "Licencia de conducción vigente" },
      { id: "co_casco_abrochado", text: "Casco certificado y correctamente abrochado" }
    ]
  }
];

// Flat items list for easier referencing
const ALL_ITEMS = CHECKLIST_STRUCTURE.flatMap(g => g.items);

// --- 2. Database Adapter with Dexie + LocalStorage Hybrid Resilience ---
let dexieDb = null;
try {
  dexieDb = new Dexie('kikes_preop_v3_db');
  dexieDb.version(1).stores({
    weeks: 'id, dateStart, dateEnd, placa, finishedDaysCount',
    presets: '++id, placa, zona, area',
    operators: '++id, name',
    settings: 'key, value'
  });
} catch (e) {
  console.warn("Dexie instance error, using local storage adapter:", e);
}

class StorageTable {
  constructor(name, keyPath = 'id', isAutoInc = false) {
    this.name = name;
    this.keyPath = keyPath;
    this.isAutoInc = isAutoInc;
  }

  _readLocal() {
    try {
      const raw = localStorage.getItem(`kikes_preop_${this.name}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  _writeLocal(list) {
    try {
      localStorage.setItem(`kikes_preop_${this.name}`, JSON.stringify(list));
    } catch (e) {
      console.warn("LocalStorage write warning:", e);
    }
  }

  async toArray() {
    if (dexieDb) {
      try {
        const data = await dexieDb[this.name].toArray();
        if (data && data.length > 0) {
          this._writeLocal(data);
          return data;
        }
      } catch (e) {
        console.warn(`Dexie ${this.name}.toArray fallback to localStorage:`, e);
      }
    }
    return this._readLocal();
  }

  async get(key) {
    if (dexieDb) {
      try {
        const item = await dexieDb[this.name].get(key);
        if (item) return item;
      } catch (e) {
        console.warn(`Dexie ${this.name}.get fallback to localStorage:`, e);
      }
    }
    const list = this._readLocal();
    return list.find(item => item[this.keyPath] === key) || null;
  }

  async add(item) {
    const newItem = { ...item };
    if (this.isAutoInc && !newItem[this.keyPath]) {
      newItem[this.keyPath] = Date.now() + Math.floor(Math.random() * 1000);
    }
    if (dexieDb) {
      try {
        const id = await dexieDb[this.name].add(item);
        if (id) newItem[this.keyPath] = id;
      } catch (e) {
        console.warn(`Dexie ${this.name}.add fallback to localStorage:`, e);
      }
    }
    const list = this._readLocal();
    list.push(newItem);
    this._writeLocal(list);
    return newItem[this.keyPath];
  }

  async put(item) {
    const newItem = { ...item };
    if (this.isAutoInc && !newItem[this.keyPath]) {
      newItem[this.keyPath] = Date.now() + Math.floor(Math.random() * 1000);
    }
    if (dexieDb) {
      try {
        await dexieDb[this.name].put(item);
      } catch (e) {
        console.warn(`Dexie ${this.name}.put fallback to localStorage:`, e);
      }
    }
    const list = this._readLocal();
    const idx = list.findIndex(i => i[this.keyPath] === newItem[this.keyPath]);
    if (idx >= 0) {
      list[idx] = newItem;
    } else {
      list.push(newItem);
    }
    this._writeLocal(list);
    return newItem[this.keyPath];
  }

  async delete(key) {
    if (dexieDb) {
      try {
        await dexieDb[this.name].delete(key);
      } catch (e) {
        console.warn(`Dexie ${this.name}.delete fallback to localStorage:`, e);
      }
    }
    let list = this._readLocal();
    list = list.filter(i => i[this.keyPath] !== key);
    this._writeLocal(list);
  }

  async clear() {
    if (dexieDb) {
      try {
        await dexieDb[this.name].clear();
      } catch (e) {}
    }
    this._writeLocal([]);
  }

  where(field) {
    const self = this;
    return {
      equals(val) {
        return {
          async toArray() {
            const list = await self.toArray();
            return list.filter(item => String(item[field] || '').toUpperCase() === String(val || '').toUpperCase());
          },
          async first() {
            const list = await self.toArray();
            return list.find(item => String(item[field] || '').toUpperCase() === String(val || '').toUpperCase()) || null;
          }
        };
      },
      equalsIgnoreCase(val) {
        return this.equals(val);
      }
    };
  }
}

const db = {
  weeks: new StorageTable('weeks', 'id', false),
  presets: new StorageTable('presets', 'id', true),
  operators: new StorageTable('operators', 'id', true),
  settings: new StorageTable('settings', 'key', false),
  async open() {
    if (dexieDb) {
      try {
        await dexieDb.open();
      } catch (e) {
        console.warn("Dexie open failed, falling back to local storage engine:", e);
      }
    }
  },
  async clearAll() {
    await this.weeks.clear();
    await this.presets.clear();
    await this.operators.clear();
    await this.settings.clear();
    if (dexieDb) {
      try { await dexieDb.delete(); } catch(e) {}
    }
  }
};

// --- 3. App State ---
const STATE = {
  currentWeekId: '',      // Format YYYY-Www (e.g. 2026-W33)
  currentPlaca: '',
  activeDayIndex: 0,      // 0 = Lunes, 6 = Domingo
  operatorName: '',
  operatorSignature: '',  // Base64 PNG URL
  activeWeekData: null,   // Current weekly checklist data
  selectedPresetId: '',
  signatureLocked: false   // Lock active signature editing when preloaded
};

// --- Toast Notification System ---
function showToast(message, type = 'info', duration = 1800) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠️',
    info: 'ℹ'
  };
  const icon = icons[type] || '✓';
  
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });
  
  // Guaranteed auto-removal using robust setTimeout
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 350);
  }, duration);
}

// Days helper
const DAYS_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// --- 4. DOM Initialization & Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
  // A. Register PWA Service Worker
  registerServiceWorker();
  
  // B. Setup Online/Offline Status listeners
  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  // C. Setup UI Event Listeners IMMEDIATELY so buttons and navigation work right away
  setupNavigation();
  setupFormChangeHandlers();
  setupPresetsHandlers();
  setupDrawingPads();
  setupDataManagementHandlers();
  
  // D. Populate Weeks Dropdown
  generateWeeksDropdown();

  // E. Database Initialization with auto-recovery
  try {
    await db.open();
  } catch (err) {
    console.warn("Database initialization notice:", err);
  }
  
  // F. Load configurations & active week data
  try {
    await loadSettings();
    await renderOperatorsDropdown();
    await loadActiveWeekData();
  } catch (dataErr) {
    console.error("Error loading initial data:", dataErr);
  }
});

// --- 5. Navigation & View Toggles ---
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const panels = document.querySelectorAll('.view-panel');
  
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPanelId = btn.getAttribute('data-target');
      if (!targetPanelId) return;
      
      // Auto-save day data if leaving registration view
      const dilgPanel = document.getElementById('panel-diligenciar');
      if (dilgPanel && dilgPanel.classList.contains('active')) {
        try {
          saveCurrentActiveDayToState();
        } catch (err) {
          console.warn("Auto-save day warning on nav:", err);
        }
      }
      
      navButtons.forEach(b => b.classList.remove('active'));
      panels.forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });
      
      btn.classList.add('active');
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) {
        targetPanel.classList.add('active');
        targetPanel.style.display = 'flex';
      }
      
      // Scroll to top of the screen
      window.scrollTo(0, 0);
      
      // Load view specific data
      try {
        if (targetPanelId === 'panel-historico') {
          renderHistoryList();
        } else if (targetPanelId === 'panel-ajustes') {
          renderPresetsList();
          renderOperatorsList();
        }
      } catch (err) {
        console.error("Error loading panel view data:", err);
      }
    });
  });
  
  // Day tabs navigation
  const dayTabs = document.querySelectorAll('.day-tab');
  dayTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      dayTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const dayIdx = parseInt(tab.getAttribute('data-day'));
      saveCurrentActiveDayToState(); // Save data of current active day first
      STATE.activeDayIndex = dayIdx;
      
      renderActiveDayData();
    });
  });
}

// --- 6. Weeks & Date Utils ---
function getWeekDates(weekString) {
  // weekString format: YYYY-Www (e.g. 2026-W33)
  const parts = weekString.split('-W');
  const year = parseInt(parts[0]);
  const week = parseInt(parts[1]);
  
  // Find Monday of the specified week
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  } else {
    ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  }
  
  const monday = new Date(ISOweekStart);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateShort(date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function formatDateTime(date) {
  if (!date || isNaN(date.getTime())) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

function getWeekNumber(date) {
  const tempDate = new Date(date.valueOf());
  tempDate.setDate(tempDate.getDate() + 4 - (tempDate.getDay() || 7));
  const yearStart = new Date(tempDate.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1) / 7);
  return { year: tempDate.getFullYear(), week: weekNo };
}

function generateWeeksDropdown() {
  const select = document.getElementById('select-semana');
  select.innerHTML = '';
  
  const now = new Date();
  
  // Generate options for the last 5 weeks (i = -4 to 0)
  const todayVal = now.getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  
  for (let i = -4; i <= 0; i++) {
    const targetDate = new Date(todayVal + (i * oneWeekMs));
    const info = getWeekNumber(targetDate);
    const weekStr = `${info.year}-W${String(info.week).padStart(2, '0')}`;
    const dates = getWeekDates(weekStr);
    
    const option = document.createElement('option');
    option.value = weekStr;
    option.text = `Semana del ${formatDateShort(dates[0])} al ${formatDateShort(dates[6])}`;
    
    if (i === 0) {
      option.selected = true;
      STATE.currentWeekId = weekStr;
    }
    select.appendChild(option);
  }
  
  // Add "Otra..." option
  const otherOption = document.createElement('option');
  otherOption.value = 'custom';
  otherOption.text = 'Otra semana...';
  select.appendChild(otherOption);
}

// --- 7. Data Storage & Binding (IndexedDB) ---
async function loadSettings() {
  const opNameSetting = await db.settings.get('operator_name');
  STATE.operatorName = opNameSetting ? opNameSetting.value : '';
  document.getElementById('input-op-name-activo').value = STATE.operatorName;
  
  const opSigSetting = await db.settings.get('operator_signature');
  STATE.operatorSignature = opSigSetting ? opSigSetting.value : '';
  
  const activeCanvas = document.getElementById('active-signature-canvas');
  if (activeCanvas && STATE.operatorSignature) {
    drawSignatureImageOnCanvas(activeCanvas, STATE.operatorSignature);
  }
}

function initNewWeekData(weekId, placa, zona, area, tipo, hasFuelIndicator, kmPromedio = 0) {
  const dates = getWeekDates(weekId);
  const defaultFuel = (hasFuelIndicator === false) ? 'N/A' : '1/2';
  const weekData = {
    id: `${weekId}-${placa.toUpperCase()}`,
    weekId: weekId,
    dateStart: formatDateISO(dates[0]),
    dateEnd: formatDateISO(dates[6]),
    placa: placa.toUpperCase(),
    zona: zona,
    area: area,
    tipo: tipo || 'Moto',
    hasFuelIndicator: hasFuelIndicator !== false,
    kmPromedio: kmPromedio || 0,
    updatedAt: new Date().toISOString(),
    days: []
  };
  
  // Initialize Lunes to Domingo data structure
  for (let i = 0; i < 7; i++) {
    const dayData = {
      date: formatDateISO(dates[i]),
      km: null,
      fuel: defaultFuel,
      checklist: {}, // Maps item.id to "C" or "NC" or null
      observaciones: ''
    };
    
    // Set all checklist items to null (unanswered) by default
    ALL_ITEMS.forEach(item => {
      dayData.checklist[item.id] = null;
    });
    
    weekData.days.push(dayData);
  }
  return weekData;
}

async function checkPlacaFuelIndicator(placa) {
  if (!placa) return true;
  const p = await db.presets.where('placa').equalsIgnoreCase(placa).first();
  if (p && typeof p.hasFuelIndicator === 'boolean') {
    return p.hasFuelIndicator;
  }
  return true;
}

function updateFuelPickerUI() {
  const hasFuel = (STATE.hasFuelIndicator !== false);
  const selectEl = document.getElementById('meta-has-fuel');
  if (selectEl) {
    selectEl.value = hasFuel ? '1' : '0';
  }
  const fuelBtns = document.querySelectorAll('#fuel-picker-container .fuel-btn');
  
  fuelBtns.forEach(btn => {
    if (btn.getAttribute('data-fuel') === 'N/A') {
      btn.style.display = hasFuel ? 'none' : 'inline-block';
    } else {
      btn.style.display = hasFuel ? 'inline-block' : 'none';
    }
  });
}

async function loadActiveWeekData() {
  const weekId = document.getElementById('select-semana').value;
  const placa = document.getElementById('meta-placa').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const zona = document.getElementById('meta-zona').value;
  const area = document.getElementById('meta-area').value.trim();
  const tipo = document.getElementById('meta-tipo').value;
  
  STATE.currentWeekId = weekId;
  STATE.currentPlaca = placa;
  
  if (!placa) {
    // Disable form fields if no plate is provided (keep buttons clickable so warning toast fires)
    document.getElementById('tab-bar-days').style.opacity = '0.4';
    document.getElementById('tab-bar-days').style.pointerEvents = 'none';
    document.querySelector('.day-form-container').style.opacity = '0.4';
    document.querySelector('.day-form-container').style.pointerEvents = 'none';
    return;
  }
  
  // Enable form
  document.getElementById('tab-bar-days').style.opacity = '1';
  document.getElementById('tab-bar-days').style.pointerEvents = 'auto';
  document.querySelector('.day-form-container').style.opacity = '1';
  document.querySelector('.day-form-container').style.pointerEvents = 'auto';
  
  // Check preset and last record for fuel indicator and kmPromedio priority
  const preset = await db.presets.where('placa').equalsIgnoreCase(placa).first();
  const lastActiveRecord = await db.weeks.where('placa').equals(placa).first();
  
  let hasFuel = true;
  if (preset && typeof preset.hasFuelIndicator === 'boolean') {
    hasFuel = preset.hasFuelIndicator;
  } else if (lastActiveRecord && typeof lastActiveRecord.hasFuelIndicator === 'boolean') {
    hasFuel = lastActiveRecord.hasFuelIndicator;
  }
  
  let kmPromedio = 0;
  if (preset && preset.kmPromedio) {
    kmPromedio = parseFloat(preset.kmPromedio) || 0;
  } else if (lastActiveRecord && lastActiveRecord.kmPromedio) {
    kmPromedio = parseFloat(lastActiveRecord.kmPromedio) || 0;
  }
  
  const searchId = `${weekId}-${placa}`;
  let weekData = await db.weeks.get(searchId);
  
  if (!weekData) {
    const finalArea = area || (lastActiveRecord ? lastActiveRecord.area : (preset ? preset.area : ''));
    const finalZona = lastActiveRecord ? lastActiveRecord.zona : (preset ? preset.zona : zona);
    const finalTipo = lastActiveRecord ? (lastActiveRecord.tipo || 'Moto') : (preset ? (preset.tipo || 'Moto') : tipo);
    const finalKmProm = (kmPromedio > 0) ? kmPromedio : (document.getElementById('meta-km-promedio') ? (parseFloat(document.getElementById('meta-km-promedio').value) || 0) : 0);
    
    document.getElementById('meta-area').value = finalArea;
    document.getElementById('meta-zona').value = finalZona;
    document.getElementById('meta-tipo').value = finalTipo;
    document.getElementById('meta-has-fuel').value = hasFuel ? '1' : '0';
    if (document.getElementById('meta-km-promedio')) {
      document.getElementById('meta-km-promedio').value = finalKmProm > 0 ? finalKmProm : '';
    }
    STATE.hasFuelIndicator = hasFuel;
    STATE.kmPromedio = finalKmProm;
    
    weekData = initNewWeekData(weekId, placa, finalZona, finalArea, finalTipo, hasFuel, finalKmProm);
  } else {
    // If weekData exists, preset configuration still overrides if available
    if (preset && typeof preset.hasFuelIndicator === 'boolean') {
      hasFuel = preset.hasFuelIndicator;
    } else if (typeof weekData.hasFuelIndicator === 'boolean') {
      hasFuel = weekData.hasFuelIndicator;
    }
    
    if (preset && preset.kmPromedio) {
      kmPromedio = parseFloat(preset.kmPromedio) || 0;
    } else if (typeof weekData.kmPromedio === 'number' && weekData.kmPromedio > 0) {
      kmPromedio = weekData.kmPromedio;
    }
    
    document.getElementById('meta-zona').value = weekData.zona;
    document.getElementById('meta-area').value = weekData.area;
    document.getElementById('meta-tipo').value = weekData.tipo || 'Moto';
    document.getElementById('meta-has-fuel').value = hasFuel ? '1' : '0';
    if (document.getElementById('meta-km-promedio')) {
      document.getElementById('meta-km-promedio').value = kmPromedio > 0 ? kmPromedio : (weekData.kmPromedio || '');
    }
    STATE.hasFuelIndicator = hasFuel;
    STATE.kmPromedio = kmPromedio;
    weekData.hasFuelIndicator = hasFuel;
    weekData.kmPromedio = kmPromedio;
  }
  
  // Force fuel = 'N/A' across all 7 days if vehicle has no fuel indicator
  if (!STATE.hasFuelIndicator) {
    weekData.days.forEach(d => { d.fuel = 'N/A'; });
  }
  
  STATE.activeWeekData = weekData;
  applyKmCascade(STATE.activeWeekData, 0);
  renderActiveDayData();
  updatePrevKmButtonContainer();
}

function applyKmCascade(weekData, fromDayIndex = 0) {
  if (!weekData || !weekData.days) return;
  
  const metaKmEl = document.getElementById('meta-km-promedio');
  const kmPromedio = parseFloat(weekData.kmPromedio || (metaKmEl ? metaKmEl.value : 0) || 0);
  
  // 1. If kmPromedio is set (> 0), cascade to subsequent empty or auto-cascaded days
  if (kmPromedio > 0) {
    for (let i = Math.max(0, fromDayIndex); i < 6; i++) {
      const currentDay = weekData.days[i];
      const nextDay = weekData.days[i + 1];
      
      if (currentDay && currentDay.km !== null && !isNaN(currentDay.km) && currentDay.km > 0) {
        // If next day is empty OR was previously calculated by cascade, update it
        if (nextDay.km === null || isNaN(nextDay.km) || nextDay.isAutoCascaded) {
          nextDay.km = Math.round((currentDay.km + kmPromedio) * 10) / 10;
          nextDay.isAutoCascaded = true;
        }
      }
    }
  }

  // 2. Minimum validation: ensure day[i+1].km >= day[i].km
  let currentMinKm = null;
  for (let i = 0; i < 7; i++) {
    const day = weekData.days[i];
    if (day.km !== null && !isNaN(day.km)) {
      if (currentMinKm !== null && day.km < currentMinKm) {
        day.km = currentMinKm;
      } else {
        currentMinKm = day.km;
      }
    }
  }
}

function saveCurrentActiveDayToState() {
  if (!STATE.activeWeekData) return;
  
  const dayData = STATE.activeWeekData.days[STATE.activeDayIndex];
  
  // Save Kilometraje
  const kmInput = document.getElementById('day-km').value;
  const newKm = kmInput ? parseFloat(kmInput) : null;
  
  if (newKm !== dayData.km) {
    dayData.isAutoCascaded = false; // User manually set this value
  }
  dayData.km = newKm;
  
  // Save kmPromedio from metadata
  const metaKmEl = document.getElementById('meta-km-promedio');
  if (metaKmEl && metaKmEl.value !== '') {
    STATE.activeWeekData.kmPromedio = parseFloat(metaKmEl.value) || 0;
  }
  
  // Apply cascading mileage to subsequent days
  applyKmCascade(STATE.activeWeekData, STATE.activeDayIndex);
  
  // Save Fuel Level
  const activeFuelBtn = document.querySelector('.fuel-btn.active');
  dayData.fuel = activeFuelBtn ? activeFuelBtn.getAttribute('data-fuel') : '1/2';
  
  // Save Observaciones
  dayData.observaciones = document.getElementById('day-observaciones').value.trim();
  
  // Save checklist C/NC statuses
  ALL_ITEMS.forEach(item => {
    const activeToggle = document.querySelector(`.toggle-btn.active[data-item="${item.id}"]`);
    dayData.checklist[item.id] = activeToggle ? activeToggle.getAttribute('data-status') : null;
  });
}

function renderActiveDayData() {
  if (!STATE.activeWeekData) return;
  
  const dayData = STATE.activeWeekData.days[STATE.activeDayIndex];
  
  // Update Title
  document.getElementById('day-title-header').innerText = `Diligenciando ${DAYS_NAMES[STATE.activeDayIndex]}`;
  
  // Set Kilometraje
  document.getElementById('day-km').value = dayData.km !== null ? dayData.km : '';
  
  // Set Fuel Level
  const fuelButtons = document.querySelectorAll('.fuel-btn');
  updateFuelPickerUI();
  
  if (STATE.hasFuelIndicator === false) {
    dayData.fuel = 'N/A';
  } else if (dayData.fuel === 'N/A' || !dayData.fuel) {
    dayData.fuel = '1/2';
  }
  
  fuelButtons.forEach(btn => {
    if (btn.getAttribute('data-fuel') === dayData.fuel) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Set Observaciones
  document.getElementById('day-observaciones').value = dayData.observaciones || '';
  
  // Render Checklist layout
  renderChecklistGrid(dayData);
  updatePrevKmButtonContainer();
}

function renderChecklistGrid(dayData) {
  const container = document.getElementById('checklist-container');
  container.innerHTML = '';
  
  const currentTipo = STATE.activeWeekData ? (STATE.activeWeekData.tipo || document.getElementById('meta-tipo').value) : document.getElementById('meta-tipo').value;
  const isMoto = (currentTipo === 'Moto');
  
  CHECKLIST_STRUCTURE.forEach(group => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'checklist-group';
    
    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `<span>${group.category}</span>`;
    groupDiv.appendChild(header);
    
    const itemsList = document.createElement('div');
    itemsList.className = 'group-items-list';
    
    group.items.forEach(item => {
      const itemDiv = document.createElement('div');
      const isDisabledItem = item.onlyMotocarga && isMoto;
      itemDiv.className = `checklist-item ${isDisabledItem ? 'disabled-motocarga' : ''}`;
      
      // If disabled because vehicle is Moto, keep item answer as null
      if (isDisabledItem) {
        dayData.checklist[item.id] = null;
      }
      
      const currentVal = dayData.checklist[item.id]; // 'C', 'NC', or null
      const disabledAttr = isDisabledItem ? 'disabled' : '';
      const disabledTextNote = isDisabledItem ? ' <span class="na-tag">(N/A - Solo Motocarga)</span>' : '';
      
      itemDiv.innerHTML = `
        <div class="item-text">${item.text}${disabledTextNote}</div>
        <div class="item-toggle-group">
          <button type="button" class="toggle-btn toggle-btn-c ${currentVal === 'C' ? 'active' : ''}" data-item="${item.id}" data-status="C" ${disabledAttr}>C</button>
          <button type="button" class="toggle-btn toggle-btn-nc ${currentVal === 'NC' ? 'active' : ''}" data-item="${item.id}" data-status="NC" ${disabledAttr}>NC</button>
        </div>
      `;
      
      itemsList.appendChild(itemDiv);
    });
    
    groupDiv.appendChild(itemsList);
    container.appendChild(groupDiv);
  });
  
  // Setup click handlers for checklist toggle buttons
  const toggleBtns = container.querySelectorAll('.toggle-btn:not([disabled])');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.getAttribute('data-item');
      const status = btn.getAttribute('data-status');
      const siblings = btn.parentElement.querySelectorAll('.toggle-btn');
      
      if (btn.classList.contains('active')) {
        // Toggle off if clicking active
        btn.classList.remove('active');
        STATE.activeWeekData.days[STATE.activeDayIndex].checklist[itemId] = null;
      } else {
        siblings.forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        STATE.activeWeekData.days[STATE.activeDayIndex].checklist[itemId] = status;
      }
    });
  });
}

async function updatePrevKmButtonContainer() {
  const container = document.getElementById('copy-prev-km-container');
  if (STATE.activeDayIndex === 0) {
    // Monday has no previous day in current week data
    // Let's search previous week in DB
    const parts = STATE.currentWeekId.split('-W');
    const year = parseInt(parts[0]);
    const week = parseInt(parts[1]);
    const prevWeekStr = `${year}-W${String(week - 1).padStart(2, '0')}`;
    const prevWeekData = await db.weeks.get(`${prevWeekStr}-${STATE.currentPlaca}`);
    
    if (prevWeekData && prevWeekData.days[6].km !== null) {
      container.style.display = 'block';
      container.setAttribute('data-prev-km', prevWeekData.days[6].km);
    } else {
      container.style.display = 'none';
    }
  } else {
    // Check previous day in current week
    const prevDayData = STATE.activeWeekData.days[STATE.activeDayIndex - 1];
    if (prevDayData && prevDayData.km !== null) {
      container.style.display = 'block';
      container.setAttribute('data-prev-km', prevDayData.km);
    } else {
      container.style.display = 'none';
    }
  }
}

// --- 8. Form Actions Logic ---
function setupFormChangeHandlers() {
  const selectSemana = document.getElementById('select-semana');
  const customWeekPicker = document.getElementById('custom-week-picker');
  
  selectSemana.addEventListener('change', async () => {
    const val = selectSemana.value;
    if (val === 'custom') {
      customWeekPicker.style.display = 'block';
      customWeekPicker.focus();
    } else {
      customWeekPicker.style.display = 'none';
      await loadActiveWeekData();
    }
  });
  
  customWeekPicker.addEventListener('change', async () => {
    const pickerVal = customWeekPicker.value;
    if (!pickerVal) return;
    
    const parts = pickerVal.split('-W');
    if (parts.length === 2) {
      const year = parts[0];
      const weekNum = String(parts[1]).padStart(2, '0');
      const weekStr = `${year}-W${weekNum}`;
      
      const dates = getWeekDates(weekStr);
      
      let optionExists = false;
      for (let i = 0; i < selectSemana.options.length; i++) {
        if (selectSemana.options[i].value === weekStr) {
          selectSemana.selectedIndex = i;
          optionExists = true;
          break;
        }
      }
      
      if (!optionExists) {
        const opt = document.createElement('option');
        opt.value = weekStr;
        opt.text = `Semana del ${formatDateShort(dates[0])} al ${formatDateShort(dates[6])}`;
        selectSemana.insertBefore(opt, selectSemana.options[selectSemana.options.length - 1]);
        selectSemana.value = weekStr;
      }
      
      customWeekPicker.style.display = 'none';
      await loadActiveWeekData();
    }
  });

  document.getElementById('meta-placa').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!STATE.activeWeekData || STATE.activeWeekData.placa !== e.target.value) {
      loadActiveWeekData();
    }
  });
  document.getElementById('meta-tipo').addEventListener('change', () => {
    if (STATE.activeWeekData) {
      STATE.activeWeekData.tipo = document.getElementById('meta-tipo').value;
      renderActiveDayData();
    }
  });
  document.getElementById('meta-has-fuel').addEventListener('change', (e) => {
    const hasFuel = (e.target.value === '1');
    STATE.hasFuelIndicator = hasFuel;
    if (STATE.activeWeekData) {
      STATE.activeWeekData.hasFuelIndicator = hasFuel;
    }
    renderActiveDayData();
  });
  document.getElementById('meta-zona').addEventListener('change', () => {
    if (STATE.activeWeekData) STATE.activeWeekData.zona = document.getElementById('meta-zona').value;
  });
  document.getElementById('meta-area').addEventListener('input', () => {
    if (STATE.activeWeekData) STATE.activeWeekData.area = document.getElementById('meta-area').value.trim();
  });
  const metaKmPromInput = document.getElementById('meta-km-promedio');
  if (metaKmPromInput) {
    metaKmPromInput.addEventListener('input', () => {
      const val = parseFloat(metaKmPromInput.value) || 0;
      STATE.kmPromedio = val;
      if (STATE.activeWeekData) {
        STATE.activeWeekData.kmPromedio = val;
        applyKmCascade(STATE.activeWeekData, 0);
        renderActiveDayData();
      }
    });
  }
  
  // Fuel Picker Selection
  document.querySelector('.fuel-level-picker').addEventListener('click', (e) => {
    if (e.target.classList.contains('fuel-btn')) {
      document.querySelectorAll('.fuel-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    }
  });
  
  // "Copiar Km anterior"
  document.getElementById('btn-copy-km').addEventListener('click', () => {
    const container = document.getElementById('copy-prev-km-container');
    const prevKm = container.getAttribute('data-prev-km');
    if (prevKm) {
      document.getElementById('day-km').value = prevKm;
      STATE.activeWeekData.days[STATE.activeDayIndex].km = parseFloat(prevKm);
      STATE.activeWeekData.days[STATE.activeDayIndex].isAutoCascaded = false;
      applyKmCascade(STATE.activeWeekData, STATE.activeDayIndex);
    }
  });

  // Day Km input live cascade listener
  document.getElementById('day-km').addEventListener('input', () => {
    saveCurrentActiveDayToState();
  });
  
  // "Llenar Día como Conforme"
  document.getElementById('btn-fill-day').addEventListener('click', () => {
    if (!STATE.activeWeekData) return;
    
    const isMoto = (STATE.activeWeekData.tipo || document.getElementById('meta-tipo').value || 'Moto') === 'Moto';
    const dayData = STATE.activeWeekData.days[STATE.activeDayIndex];
    ALL_ITEMS.forEach(item => {
      if (item.onlyMotocarga && isMoto) {
        dayData.checklist[item.id] = null;
      } else {
        dayData.checklist[item.id] = 'C';
      }
    });
    
    // Automatically select fuel as 1/2 if blank (or N/A if vehicle has no fuel meter)
    if (STATE.hasFuelIndicator === false) {
      dayData.fuel = 'N/A';
    } else if (!dayData.fuel || dayData.fuel === 'N/A') {
      dayData.fuel = '1/2';
    }
    
    renderActiveDayData();
  });
  
  // "Toda la Semana OK"
  document.getElementById('btn-fill-week').addEventListener('click', async () => {
    const placa = document.getElementById('meta-placa').value.trim();
    if (!placa) {
      showToast("Debe ingresar la placa del vehículo para autocompletar", "warning", 2000);
      return;
    }
    if (!STATE.activeWeekData) await loadActiveWeekData();
    if (!STATE.activeWeekData) return;
    
    const confirmFill = confirm("¿Desea autocompletar Lunes a Domingo con respuestas 'Conforme' por defecto? El kilometraje se estimará incrementalmente.");
    if (!confirmFill) return;
    
    saveCurrentActiveDayToState(); // Save what is currently edited
    
    const isMoto = (STATE.activeWeekData.tipo || document.getElementById('meta-tipo').value || 'Moto') === 'Moto';
    let baseKm = parseFloat(document.getElementById('day-km').value) || 0;
    if (baseKm === 0) {
      // Look for previous week's Sunday
      const container = document.getElementById('copy-prev-km-container');
      const prevKm = container.getAttribute('data-prev-km');
      baseKm = prevKm ? parseFloat(prevKm) : 10000;
    }
    
    const kmIncrement = (STATE.activeWeekData.kmPromedio && STATE.activeWeekData.kmPromedio > 0)
      ? STATE.activeWeekData.kmPromedio
      : 20;
    
    STATE.activeWeekData.days.forEach((dayData, idx) => {
      // 1. Checklist
      ALL_ITEMS.forEach(item => {
        if (item.onlyMotocarga && isMoto) {
          dayData.checklist[item.id] = null;
        } else {
          dayData.checklist[item.id] = 'C';
        }
      });
      // 2. Fuel
      if (STATE.hasFuelIndicator === false) {
        dayData.fuel = 'N/A';
      } else if (!dayData.fuel || dayData.fuel === 'N/A') {
        dayData.fuel = '1/2';
      }
      // 3. Estimate Km (increase by kmIncrement daily)
      if (dayData.km === null) {
        dayData.km = baseKm + (idx * kmIncrement);
        dayData.isAutoCascaded = true;
      }
    });
    
    renderActiveDayData();
    showToast("Semana completada con respuestas conforme por defecto", "success", 1800);
  });

  // "Cargar Último" (Copy last registered week from DB history)
  document.getElementById('btn-copy-last-week').addEventListener('click', async () => {
    const placa = document.getElementById('meta-placa').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!placa) {
      showToast("Debe ingresar la placa del vehículo para cargar el último registro", "warning", 2000);
      return;
    }
    
    // Ensure active week data exists
    if (!STATE.activeWeekData || STATE.activeWeekData.placa !== placa) {
      await loadActiveWeekData();
    }
    
    if (!STATE.activeWeekData) {
      showToast("No se pudo inicializar la semana activa", "error", 2000);
      return;
    }

    // Search DB for all weeks saved for this plate
    let plateWeeks = await db.weeks.where('placa').equals(placa).toArray();
    
    // Filter out the current active week
    plateWeeks = plateWeeks.filter(w => w.weekId !== STATE.currentWeekId);
    
    if (plateWeeks.length === 0) {
      showToast(`No hay semanas guardadas en el historial para la placa ${placa}`, "warning", 2500);
      return;
    }
    
    // Sort weeks descending by weekId / id so the most recent is first
    plateWeeks.sort((a, b) => b.weekId.localeCompare(a.weekId));
    const lastWeek = plateWeeks[0];
    
    // Find the last recorded mileage from lastWeek (search Sunday down to Monday)
    let lastKm = null;
    for (let i = 6; i >= 0; i--) {
      if (lastWeek.days && lastWeek.days[i] && lastWeek.days[i].km !== null && !isNaN(lastWeek.days[i].km)) {
        lastKm = lastWeek.days[i].km;
        break;
      }
    }
    
    // Copy checklist answers, fuel levels, and observations from lastWeek to activeWeekData
    STATE.activeWeekData.days.forEach((day, idx) => {
      const srcDay = lastWeek.days[idx];
      if (srcDay) {
        day.checklist = JSON.parse(JSON.stringify(srcDay.checklist));
        day.fuel = srcDay.fuel || '1/2';
        day.observaciones = srcDay.observaciones || '';
      }
    });
    
    // Set Lunes' mileage to lastKm if found
    if (lastKm !== null) {
      STATE.activeWeekData.days[0].km = lastKm;
      STATE.activeWeekData.days[0].isAutoCascaded = false;
    }
    
    if (lastWeek.kmPromedio) {
      STATE.activeWeekData.kmPromedio = lastWeek.kmPromedio;
      if (document.getElementById('meta-km-promedio')) {
        document.getElementById('meta-km-promedio').value = lastWeek.kmPromedio;
      }
    }
    
    // Run cascading mileage validation so Monday's mileage propagates forward if needed
    applyKmCascade(STATE.activeWeekData, 0);
    
    // Render current active day
    renderActiveDayData();
    
    showToast(`Cargados datos de la Semana ${lastWeek.weekId}. Km inicial (Lunes): ${lastKm !== null ? lastKm : 'N/A'}`, "success", 2500);
  });
  
  // "Guardar Progreso de la Semana"
  document.getElementById('btn-save-week').addEventListener('click', async () => {
    const placa = document.getElementById('meta-placa').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!placa) {
      showToast("Debe ingresar la placa del vehículo para guardar el progreso", "warning", 2000);
      return;
    }

    if (!STATE.activeWeekData || STATE.activeWeekData.placa !== placa) {
      await loadActiveWeekData();
    }
    
    if (!STATE.activeWeekData) {
      showToast("No se pudo inicializar la semana activa", "error", 2000);
      return;
    }
    
    // Save current active day inputs FIRST before anything else!
    saveCurrentActiveDayToState();

    STATE.activeWeekData.placa = placa;
    STATE.activeWeekData.zona = document.getElementById('meta-zona').value;
    STATE.activeWeekData.area = document.getElementById('meta-area').value.trim();
    STATE.activeWeekData.tipo = document.getElementById('meta-tipo').value;
    STATE.activeWeekData.hasFuelIndicator = (document.getElementById('meta-has-fuel').value === '1');
    const kmPromVal = document.getElementById('meta-km-promedio') ? (parseFloat(document.getElementById('meta-km-promedio').value) || 0) : 0;
    STATE.activeWeekData.kmPromedio = kmPromVal;
    
    const isMoto = STATE.activeWeekData.tipo === 'Moto';
    const applicableItems = ALL_ITEMS.filter(item => !(item.onlyMotocarga && isMoto));
    
    // Calculate finished days count
    let finishedDays = 0;
    STATE.activeWeekData.days.forEach(day => {
      const answeredCount = Object.keys(day.checklist).filter(id => {
        const isApplicable = applicableItems.some(i => i.id === id);
        return isApplicable && day.checklist[id] !== null;
      }).length;
      if (answeredCount === applicableItems.length && day.km !== null) {
        finishedDays++;
      }
    });
    
    STATE.activeWeekData.finishedDaysCount = finishedDays;
    STATE.activeWeekData.updatedAt = new Date().toISOString();
    
    try {
      await db.weeks.put(STATE.activeWeekData);
      showToast("Progreso de la semana guardado con éxito", "success", 2000);
    } catch (e) {
      console.error(e);
      showToast("Error al guardar en base de datos: " + e.message, "error", 2500);
    }
  });

  // "Generar PDF" (Main button)
  document.getElementById('btn-generate-pdf-main').addEventListener('click', async () => {
    const placa = document.getElementById('meta-placa').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!placa) {
      showToast("Debe ingresar la placa del vehículo para generar el PDF", "warning", 2000);
      return;
    }
    if (!STATE.activeWeekData || STATE.activeWeekData.placa !== placa) {
      await loadActiveWeekData();
    }
    saveCurrentActiveDayToState();
    if (STATE.activeWeekData) {
      STATE.activeWeekData.placa = placa;
      STATE.activeWeekData.tipo = document.getElementById('meta-tipo').value;
      STATE.activeWeekData.hasFuelIndicator = (document.getElementById('meta-has-fuel').value === '1');
      await db.weeks.put(STATE.activeWeekData);
      await generatePdfForWeek(STATE.activeWeekData);
    }
  });

  // "Enviar Correo" (Main button)
  document.getElementById('btn-send-email-main').addEventListener('click', async () => {
    const placa = document.getElementById('meta-placa').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!placa) {
      showToast("Debe ingresar la placa del vehículo para enviar por correo", "warning", 2000);
      return;
    }
    if (!STATE.activeWeekData || STATE.activeWeekData.placa !== placa) {
      await loadActiveWeekData();
    }
    saveCurrentActiveDayToState();
    if (STATE.activeWeekData) {
      STATE.activeWeekData.placa = placa;
      STATE.activeWeekData.tipo = document.getElementById('meta-tipo').value;
      STATE.activeWeekData.hasFuelIndicator = (document.getElementById('meta-has-fuel').value === '1');
      await db.weeks.put(STATE.activeWeekData);
      await sendWeekByEmail(STATE.activeWeekData);
    }
  });
}

function isCanvasBlank(canvas) {
  if (!canvas) return true;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      return false; // Found a non-transparent pixel
    }
  }
  return true;
}

// --- 9. Presets & Default Configuration Management ---
async function setupPresetsHandlers() {
  // Add operator button from Settings
  document.getElementById('btn-save-sig').addEventListener('click', async () => {
    try {
      const name = document.getElementById('settings-op-name').value.trim();
      const canvas = document.getElementById('signature-canvas');
      
      if (!name) {
        showToast("Debe ingresar el nombre del operador", "warning", 1800);
        return;
      }
      
      if (isCanvasBlank(canvas)) {
        showToast("Debe dibujar la firma del operador", "warning", 1800);
        return;
      }
      
      const sigData = canvas.toDataURL('image/png');
      
      await db.operators.add({ name, signature: sigData });
      
      document.getElementById('settings-op-name').value = '';
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      showToast("Operador guardado con éxito", "success", 1800);
      await renderOperatorsList();
      await renderOperatorsDropdown();
    } catch (err) {
      console.error("Error al guardar operador:", err);
      showToast("Error al guardar operador: " + err.message, "error", 2500);
    }
  });

  // Select Operator Event on Registrar panel
  document.getElementById('select-operador-activo').addEventListener('change', async (e) => {
    try {
      const opId = e.target.value;
      if (!opId) return;
      
      const op = await db.operators.get(parseInt(opId));
      if (op) {
        document.getElementById('input-op-name-activo').value = op.name;
        STATE.operatorName = op.name;
        STATE.operatorSignature = op.signature;
        
        await db.settings.put({ key: 'operator_name', value: op.name });
        await db.settings.put({ key: 'operator_signature', value: op.signature });
        
        const activeCanvas = document.getElementById('active-signature-canvas');
        drawSignatureImageOnCanvas(activeCanvas, op.signature);
        
        lockActiveSignature(true);
        document.getElementById('select-operador-activo').value = '';
      }
    } catch (err) {
      console.error("Error al cargar operador:", err);
    }
  });

  // Active Operator name input change handler
  document.getElementById('input-op-name-activo').addEventListener('input', async (e) => {
    STATE.operatorName = e.target.value.trim();
    await db.settings.put({ key: 'operator_name', value: STATE.operatorName });
  });

  // Add preset button
  document.getElementById('preset-placa').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  });

  document.getElementById('btn-add-preset').addEventListener('click', async () => {
    try {
      const placa = document.getElementById('preset-placa').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const tipo = document.getElementById('preset-tipo').value;
      const zona = document.getElementById('preset-zona').value;
      const area = document.getElementById('preset-area').value.trim();
      const hasFuelIndicator = document.getElementById('preset-has-fuel').value === '1';
      const kmPromedio = document.getElementById('preset-km-promedio') ? (parseFloat(document.getElementById('preset-km-promedio').value) || 0) : 0;
      
      if (!placa) {
        showToast("Debe ingresar la placa del vehículo", "warning", 1800);
        return;
      }
      
      await db.presets.add({ placa, tipo, zona, area, hasFuelIndicator, kmPromedio });
      
      document.getElementById('preset-placa').value = '';
      document.getElementById('preset-tipo').value = 'Moto';
      document.getElementById('preset-area').value = '';
      if (document.getElementById('preset-km-promedio')) document.getElementById('preset-km-promedio').value = '';
      document.getElementById('preset-has-fuel').value = '1';
      
      showToast("Perfil de vehículo guardado con éxito", "success", 1800);
      await renderPresetsList();
      await renderPresetsDropdown();
    } catch (err) {
      console.error("Error al guardar perfil de vehículo:", err);
      showToast("Error al guardar perfil: " + err.message, "error", 2500);
    }
  });
  
  // Select Preset Event
  document.getElementById('select-preset').addEventListener('change', async (e) => {
    try {
      const presetId = e.target.value;
      if (!presetId) return;
      
      const preset = await db.presets.get(parseInt(presetId));
      if (preset) {
        document.getElementById('meta-placa').value = preset.placa;
        document.getElementById('meta-tipo').value = preset.tipo || 'Moto';
        document.getElementById('meta-zona').value = preset.zona;
        document.getElementById('meta-area').value = preset.area;
        document.getElementById('meta-has-fuel').value = (preset.hasFuelIndicator !== false) ? '1' : '0';
        if (document.getElementById('meta-km-promedio')) {
          document.getElementById('meta-km-promedio').value = (preset.kmPromedio !== undefined && preset.kmPromedio !== null && preset.kmPromedio > 0) ? preset.kmPromedio : '';
        }
        STATE.hasFuelIndicator = (preset.hasFuelIndicator !== false);
        STATE.kmPromedio = preset.kmPromedio || 0;
        
        await loadActiveWeekData();
        document.getElementById('select-preset').value = ''; // Reset dropdown
      }
    } catch (err) {
      console.error("Error al seleccionar preset:", err);
    }
  });
  
  renderPresetsDropdown();
}

async function renderPresetsList() {
  const container = document.getElementById('presets-list');
  if (!container) return;
  container.innerHTML = '';
  
  try {
    const list = await db.presets.toArray();
    if (!list || list.length === 0) {
      container.innerHTML = '<p class="helper-text">No hay perfiles configurados. Añada uno abajo.</p>';
      return;
    }
    
    list.forEach(p => {
      const div = document.createElement('div');
      div.className = 'preset-card';
      const fuelText = (p.hasFuelIndicator !== false) ? 'Gasolina: SÍ' : 'Gasolina: NO (N/A)';
      const tipoText = p.tipo || 'Moto';
      const kmText = (p.kmPromedio && p.kmPromedio > 0) ? ` | Km Prom: ${p.kmPromedio} km/día` : '';
      div.innerHTML = `
        <div class="preset-info">
          <span class="preset-title">${p.placa}</span> (${tipoText}) | ${p.zona} - ${p.area}${kmText} | <span style="font-weight: 500; font-size: 11px; color: var(--text-secondary);">${fuelText}</span>
        </div>
        <button class="btn btn-danger btn-sm btn-delete-preset" data-id="${p.id}">Eliminar</button>
      `;
      
      div.querySelector('.btn-delete-preset').addEventListener('click', async () => {
        if (confirm(`¿Eliminar perfil de placa ${p.placa}?`)) {
          await db.presets.delete(p.id);
          await renderPresetsList();
          await renderPresetsDropdown();
        }
      });
      
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Error al renderizar lista de perfiles:", err);
    container.innerHTML = `<p class="helper-text error-text">Error al cargar perfiles: ${err.message}</p>`;
  }
}

async function renderPresetsDropdown() {
  const dropdown = document.getElementById('select-preset');
  if (!dropdown) return;
  dropdown.innerHTML = '<option value="">-- Cargar Perfil Rápido --</option>';
  
  try {
    const list = await db.presets.toArray();
    list.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      const labelArea = p.area ? p.area : (p.zona || 'Perfil');
      opt.text = `${p.placa} (${labelArea})`;
      dropdown.appendChild(opt);
    });
  } catch (err) {
    console.error("Error al renderizar dropdown de perfiles:", err);
  }
}

async function renderOperatorsList() {
  const container = document.getElementById('operators-list');
  if (!container) return;
  container.innerHTML = '';
  
  try {
    const list = await db.operators.toArray();
    if (!list || list.length === 0) {
      container.innerHTML = '<p class="helper-text">No hay operadores preguardados.</p>';
      return;
    }
    
    list.forEach(op => {
      const div = document.createElement('div');
      div.className = 'preset-card';
      div.innerHTML = `
        <div class="preset-info" style="display:flex; align-items:center; gap: 12px; flex:1;">
          <span class="preset-title" style="min-width: 120px; font-weight:700;">${op.name}</span>
          <img src="${op.signature}" style="max-height: 28px; max-width: 60px; background:#fff; border:1px solid #ccc; padding:2px; border-radius:4px;">
        </div>
        <button class="btn btn-danger btn-sm btn-delete-op" data-id="${op.id}">Eliminar</button>
      `;
      
      div.querySelector('.btn-delete-op').addEventListener('click', async () => {
        if (confirm(`¿Eliminar operador ${op.name}?`)) {
          await db.operators.delete(op.id);
          await renderOperatorsList();
          await renderOperatorsDropdown();
        }
      });
      
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Error al renderizar operadores:", err);
    container.innerHTML = `<p class="helper-text error-text">Error al cargar operadores: ${err.message}</p>`;
  }
}

async function renderOperatorsDropdown() {
  const dropdown = document.getElementById('select-operador-activo');
  if (!dropdown) return;
  dropdown.innerHTML = '<option value="">-- Cargar Operador --</option>';
  
  try {
    const list = await db.operators.toArray();
    list.forEach(op => {
      const opt = document.createElement('option');
      opt.value = op.id;
      opt.text = op.name;
      dropdown.appendChild(opt);
    });
  } catch (err) {
    console.error("Error al renderizar dropdown de operadores:", err);
  }
}

// --- 10. Signature Pad Canvas Drawing ---
function setupDrawingCanvas(canvas, clearBtn) {
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  let drawing = false;
  
  const clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (clearBtn) clearBtn.addEventListener('click', clear);
  
  const getMousePos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };
  
  const startDraw = (e) => {
    // Return early if drawing on active signature canvas is locked
    if (canvas.id === 'active-signature-canvas' && STATE.signatureLocked) return;
    drawing = true;
    const pos = getMousePos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    e.preventDefault();
  };
  
  const draw = (e) => {
    if (!drawing) return;
    const pos = getMousePos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    e.preventDefault();
  };
  
  const endDraw = () => {
    drawing = false;
  };
  
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', endDraw);
  
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', endDraw);
}

function drawSignatureImageOnCanvas(canvas, base64Image) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!base64Image) return;
  const img = new Image();
  img.src = base64Image;
  img.onload = () => {
    ctx.drawImage(img, 0, 0);
  };
}

function lockActiveSignature(lock) {
  STATE.signatureLocked = lock;
  const unlockBtn = document.getElementById('btn-unlock-active-sig');
  const clearBtn = document.getElementById('btn-clear-active-sig');
  const canvas = document.getElementById('active-signature-canvas');
  
  if (lock) {
    if (unlockBtn) unlockBtn.style.display = 'inline-block';
    if (clearBtn) clearBtn.style.display = 'none';
    if (canvas) {
      canvas.style.opacity = '0.75';
      canvas.style.cursor = 'not-allowed';
    }
  } else {
    if (unlockBtn) unlockBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'inline-block';
    if (canvas) {
      canvas.style.opacity = '1.0';
      canvas.style.cursor = 'crosshair';
    }
  }
}

function setupDrawingPads() {
  const activeCanvas = document.getElementById('active-signature-canvas');
  const activeClearBtn = document.getElementById('btn-clear-active-sig');
  setupDrawingCanvas(activeCanvas, activeClearBtn);
  
  const settingsCanvas = document.getElementById('signature-canvas');
  const settingsClearBtn = document.getElementById('btn-clear-sig');
  setupDrawingCanvas(settingsCanvas, settingsClearBtn);
  
  const trackActiveSigChanges = () => {
    STATE.operatorSignature = activeCanvas.toDataURL('image/png');
    db.settings.put({ key: 'operator_signature', value: STATE.operatorSignature });
  };
  
  activeCanvas.addEventListener('mouseup', trackActiveSigChanges);
  activeCanvas.addEventListener('touchend', trackActiveSigChanges);
  activeClearBtn.addEventListener('click', () => {
    STATE.operatorSignature = '';
    db.settings.put({ key: 'operator_signature', value: '' });
  });

  // Setup unlock button event listener
  const activeUnlockBtn = document.getElementById('btn-unlock-active-sig');
  if (activeUnlockBtn) {
    activeUnlockBtn.addEventListener('click', () => {
      lockActiveSignature(false);
    });
  }
}

// --- 11. History List Rendering ---
async function renderHistoryList() {
  const container = document.getElementById('history-list');
  container.innerHTML = '';
  
  const searchVal = document.getElementById('search-history').value.trim().toLowerCase();
  
  let weeksArray = await db.weeks.toArray();
  
  // Filter search
  if (searchVal) {
    weeksArray = weeksArray.filter(w => 
      w.placa.toLowerCase().includes(searchVal) || 
      w.weekId.toLowerCase().includes(searchVal) ||
      w.area.toLowerCase().includes(searchVal)
    );
  }
  
  // Sort descending by Week ID
  weeksArray.sort((a, b) => b.id.localeCompare(a.id));
  
  if (weeksArray.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📁</div>
        <p>No se encontraron registros de semanas.</p>
      </div>
    `;
    return;
  }
  
  weeksArray.forEach((week, index) => {
    const dates = getWeekDates(week.weekId);
    const savedTimeStr = week.updatedAt ? formatDateTime(new Date(week.updatedAt)) : '';
    const isExpandedDefault = (index === 0); // Most recent record starts expanded by default
    
    const card = document.createElement('div');
    card.className = `card history-card ${isExpandedDefault ? 'expanded' : 'collapsed'}`;
    card.innerHTML = `
      <div class="history-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="history-placa">${week.placa}</span>
          <span class="history-dates">${formatDateShort(dates[0])} - ${formatDateShort(dates[6])}</span>
        </div>
        <button type="button" class="btn btn-text btn-sm btn-toggle-card" style="color: var(--accent-light); font-size: 14px; font-weight: 700; padding: 2px 8px;">
          <span class="toggle-text">${isExpandedDefault ? '▲' : '▼'}</span>
        </button>
      </div>
      
      <div class="history-body" style="${isExpandedDefault ? 'display: block;' : 'display: none;'}">
        <div class="history-details margin-top-12">
          <span class="detail-badge">Tipo: ${week.tipo || 'Moto'}</span>
          <span class="detail-badge">Zona: ${week.zona}</span>
          <span class="detail-badge">Área: ${week.area || 'Sin área'}</span>
          ${(week.kmPromedio && week.kmPromedio > 0) ? `<span class="detail-badge">Km Prom: ${week.kmPromedio} km/día</span>` : ''}
          <span class="detail-badge">Días Registrados: ${week.finishedDaysCount}/7</span>
          ${savedTimeStr ? `<span class="detail-badge" style="border-color: rgba(59, 174, 42, 0.4); color: var(--accent-light);">🕒 Guardado: ${savedTimeStr}</span>` : ''}
        </div>
        <div class="history-actions margin-top-12">
          <button class="btn btn-secondary btn-sm btn-edit-hist" data-id="${week.id}">Editar</button>
          <button class="btn btn-accent btn-sm btn-pdf-hist" data-id="${week.id}">Generar PDF</button>
          <button class="btn btn-sm btn-email-hist" data-id="${week.id}" style="background-color: #ea4335; color: #ffffff; border: none; font-weight: 500;">✉️ Correo</button>
          <button class="btn btn-danger btn-sm btn-delete-hist" data-id="${week.id}">Eliminar</button>
        </div>
      </div>
    `;
    
    // Toggle header click handler
    const headerEl = card.querySelector('.history-header');
    const bodyEl = card.querySelector('.history-body');
    const toggleTextEl = card.querySelector('.toggle-text');
    
    headerEl.addEventListener('click', () => {
      const isExpanded = card.classList.contains('expanded');
      if (isExpanded) {
        card.classList.remove('expanded');
        card.classList.add('collapsed');
        bodyEl.style.display = 'none';
        toggleTextEl.innerText = '▼';
      } else {
        card.classList.remove('collapsed');
        card.classList.add('expanded');
        bodyEl.style.display = 'block';
        toggleTextEl.innerText = '▲';
      }
    });
    
    // Wire button events
    card.querySelector('.btn-edit-hist').addEventListener('click', async () => {
      document.getElementById('select-semana').value = week.weekId;
      document.getElementById('meta-placa').value = week.placa;
      document.getElementById('meta-tipo').value = week.tipo || 'Moto';
      document.getElementById('meta-zona').value = week.zona;
      document.getElementById('meta-area').value = week.area;
      document.getElementById('meta-has-fuel').value = (week.hasFuelIndicator !== false) ? '1' : '0';
      if (document.getElementById('meta-km-promedio')) {
        document.getElementById('meta-km-promedio').value = week.kmPromedio || '';
      }
      STATE.hasFuelIndicator = (week.hasFuelIndicator !== false);
      STATE.kmPromedio = week.kmPromedio || 0;
      
      await loadActiveWeekData();
      
      // Navigate back to Registrar panel
      document.querySelector('.nav-btn[data-target="panel-diligenciar"]').click();
    });
    
    card.querySelector('.btn-pdf-hist').addEventListener('click', () => {
      generatePdfForWeek(week);
    });
    
    card.querySelector('.btn-email-hist').addEventListener('click', () => {
      sendWeekByEmail(week);
    });
    
    card.querySelector('.btn-delete-hist').addEventListener('click', async () => {
      if (confirm(`¿Eliminar permanentemente el registro de la semana ${week.weekId} para la placa ${week.placa}?`)) {
        await db.weeks.delete(week.id);
        renderHistoryList();
      }
    });
    
    container.appendChild(card);
  });
}

document.getElementById('search-history').addEventListener('input', renderHistoryList);

// --- 12. App Data Backup (JSON Export/Import) ---
function setupDataManagementHandlers() {
  // Export Database
  document.getElementById('btn-export-db').addEventListener('click', async () => {
    const dbData = {
      weeks: await db.weeks.toArray(),
      presets: await db.presets.toArray(),
      operators: await db.operators.toArray(),
      settings: await db.settings.toArray()
    };
    
    const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KikesPreop_Backup_${formatDateISO(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  
  // Import Database trigger
  document.getElementById('btn-import-db').addEventListener('click', () => {
    document.getElementById('import-db-file').click();
  });
  
  // Import File Handler
  document.getElementById('import-db-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const confirmClear = confirm("¿Desea restaurar estos datos? Se añadirán a los registros locales existentes (los registros con ID duplicados se sobrescribirán).");
        if (!confirmClear) return;
        
        if (data.weeks) {
          for (const item of data.weeks) await db.weeks.put(item);
        }
        if (data.presets) {
          for (const item of data.presets) await db.presets.put(item);
        }
        if (data.operators) {
          for (const item of data.operators) await db.operators.put(item);
        }
        if (data.settings) {
          for (const item of data.settings) await db.settings.put(item);
        }
        
        showToast("Restauración de datos completada con éxito", "success", 2000);
        await loadSettings();
        await renderOperatorsDropdown();
        await renderOperatorsList();
        await renderPresetsDropdown();
        await renderPresetsList();
        await loadActiveWeekData(); // Reload active week inputs and layout
      } catch (err) {
        showToast("Error al importar: el formato JSON no es válido", "error", 2500);
      }
    };
    reader.readAsText(file);
  });
  
  // Clear Database
  document.getElementById('btn-clear-db').addEventListener('click', async () => {
    const confirmClear = confirm("¡CUIDADO! Se borrará todo el historial de semanas, perfiles y firmas guardados localmente. ¿Está seguro?");
    if (!confirmClear) return;
    
    await db.weeks.clear();
    await db.presets.clear();
    await db.operators.clear();
    await db.settings.clear();
    
    STATE.operatorName = '';
    STATE.operatorSignature = '';
    document.getElementById('input-op-name-activo').value = '';
    
    const activeCanvas = document.getElementById('active-signature-canvas');
    if (activeCanvas) {
      const ctx = activeCanvas.getContext('2d');
      ctx.clearRect(0, 0, activeCanvas.width, activeCanvas.height);
    }
    
    showToast("Base de datos borrada exitosamente", "info", 2000);
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  });
}

// --- 13. PDF Template Compilation & html2pdf.js Trigger ---
// --- 13. PDF Template Compilation & html2pdf.js Trigger ---
function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = words[0];
  
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = font.widthOfTextAtSize(currentLine + " " + word, fontSize);
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

async function generatePdfBytesForWeek(weekData) {
  try {
    // 1. Fetch the original template PDF
    const response = await fetch('./GMA-F-10 PREOPERACIONAL MOTOCICLETAS.docx.pdf');
    if (!response.ok) throw new Error("No se pudo cargar la plantilla PDF original.");
    const existingPdfBytes = await response.arrayBuffer();
    
    // 2. Load PDF-lib
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    const pages = pdfDoc.getPages();
    const page1 = pages[0];
    const page2 = pages[1];
    
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const dates = getWeekDates(weekData.weekId);
    
    // --- Page 1 Metadata ---
    page1.drawText(formatDateShort(dates[0]), { x: 135, y: 691, size: 7.5, font: helveticaFont });
    page1.drawText(formatDateShort(dates[6]), { x: 232, y: 691, size: 7.5, font: helveticaFont });
    
    for (let d = 0; d < 7; d++) {
      const dayNum = String(dates[d].getDate()).padStart(2, '0');
      page1.drawText(dayNum, { x: 312 + d * 40.5, y: 686.5, size: 7.5, font: helveticaFont });
    }
    
    if (weekData.zona === 'Rural') {
      page1.drawText('X', { x: 205.5, y: 677.5, size: 8, font: helveticaBold });
    } else {
      page1.drawText('X', { x: 260.5, y: 677.5, size: 8, font: helveticaBold });
    }
    
    if (weekData.area) {
      page1.drawText(weekData.area, { x: 415, y: 669, size: 7.5, font: helveticaFont });
    }
    
    page1.drawText(weekData.placa.toUpperCase(), { x: 50, y: 633, size: 10, font: helveticaBold });
    
    const kmCenters = [316.0, 356.5, 397.0, 437.5, 478.0, 516.5, 554.5];
    const fuelCenters = [320.0, 360.5, 401.0, 441.5, 482.0, 518.0, 556.5];
    
    for (let d = 0; d < 7; d++) {
      const km = weekData.days[d].km;
      if (km !== null) {
        const kmStr = String(km);
        const textWidth = helveticaBold.widthOfTextAtSize(kmStr, 7.5);
        const drawX = kmCenters[d] - (textWidth / 2);
        page1.drawText(kmStr, { x: drawX, y: 638, size: 7.5, font: helveticaBold });
      }
    }
    
    const weekHasFuel = (weekData.hasFuelIndicator !== false);
    for (let d = 0; d < 7; d++) {
      const fuel = weekHasFuel ? (weekData.days[d].fuel || '1/2') : 'N/A';
      const km = weekData.days[d].km;
      if (km !== null && fuel) {
        const textWidth = helveticaBold.widthOfTextAtSize(fuel, 7.5);
        const drawX = fuelCenters[d] - (textWidth / 2);
        page1.drawText(fuel, { x: drawX, y: 608, size: 7.5, font: helveticaBold });
      }
    }
    
    // --- Page 1 Checklist Items ---
    let globalRowIdx = 0;
    const conductorY = [192.5, 178.0, 165.5, 153.0];
    
    for (let g = 0; g < CHECKLIST_STRUCTURE.length; g++) {
      const group = CHECKLIST_STRUCTURE[g];
      const isTopTable = (g < 4);
      
      for (let i = 0; i < group.items.length; i++) {
        const item = group.items[i];
        
        for (let d = 0; d < 7; d++) {
          const val = weekData.days[d].checklist[item.id];
          if (dayDataActive(weekData.days[d])) {
            if (val === 'C' || val === 'NC') {
              let drawX = 0;
              let drawY = 0;
              
              if (isTopTable) {
                drawY = 568.5 - globalRowIdx * 11.765;
                drawX = (val === 'C') ? (304.5 + d * 40.5) : (321.5 + d * 40.5);
              } else {
                const conductorRowIdx = globalRowIdx - 30;
                drawY = conductorY[conductorRowIdx];
                drawX = (val === 'C') ? (320.0 + d * 40.3) : (338.0 + d * 40.3);
              }
              
              page1.drawText('X', { 
                x: drawX, 
                y: drawY, 
                size: 7.5, 
                font: helveticaBold, 
                color: (val === 'NC') ? rgb(0.8, 0.1, 0.1) : rgb(0, 0, 0)
              });
            }
          }
        }
        globalRowIdx++;
      }
    }
    
    // --- Page 1 Novedades / Observaciones al pie ---
    const uniqueObs = [...new Set(weekData.days
      .map(d => d.observaciones?.trim())
      .filter(obs => obs && obs.toLowerCase() !== 'sin observaciones' && obs.toLowerCase() !== 'ninguna novedad relevante...')
    )];
    
    if (uniqueObs.length > 0) {
      page1.drawText('Ver observaciones detalladas al reverso (Página 2).', { x: 105, y: 112, size: 8, font: helveticaBold });
    } else {
      page1.drawText('Ninguna novedad relevante.', { x: 105, y: 112, size: 7.5, font: helveticaFont });
    }
    
    // --- Page 2: Simplified Borderless Observations List with Multi-line Wrapping & Dates ---
    let currentY = 725;
    const maxWidth = 440;
    const fontSize = 7.5;
    const dayFontSize = 6.5;
    const dateFontSize = 6.0;
    const lineHeight = 9.5;
    const DISPLAY_DAYS_NAMES = ["LUNES", "MARTES", "MIERCOL.", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];
    
    for (let idx = 0; idx < 7; idx++) {
      const day = weekData.days[idx];
      const dayLabel = DISPLAY_DAYS_NAMES[idx];
      const dayDateStr = formatDateShort(dates[idx]);
      
      page2.drawText(dayLabel, { x: 35, y: currentY, size: dayFontSize, font: helveticaBold });
      page2.drawText(dayDateStr, { x: 35, y: currentY - 8.0, size: dateFontSize, font: helveticaFont });
      
      const obsText = day.observaciones || 'Sin observaciones';
      const lines = wrapText(obsText, helveticaFont, fontSize, maxWidth);
      
      lines.forEach((line, lineIdx) => {
        page2.drawText(line, { x: 105, y: currentY - lineIdx * lineHeight, size: fontSize, font: helveticaFont });
      });
      
      currentY -= Math.max(lines.length * lineHeight + 4, 21);
    }
    
    // --- Page 2: Signatures Table ---
    const activeOpName = document.getElementById('input-op-name-activo').value.trim();
    const activeCanvas = document.getElementById('active-signature-canvas');
    let activeSigData = null;
    
    if (activeCanvas && !isCanvasBlank(activeCanvas)) {
      activeSigData = activeCanvas.toDataURL('image/png');
    }
    
    let embeddedSig = null;
    if (activeSigData) {
      embeddedSig = await pdfDoc.embedPng(activeSigData);
    }
    
    const sigCenters = [136.6, 207.8, 279.1, 350.3, 418.9, 481.2, 539.9];
    const cellWidths = [62, 62, 62, 62, 56, 48, 48];
    
    for (let d = 0; d < 7; d++) {
      const day = weekData.days[d];
      if (day.km !== null) {
        const dateStr = formatDateShort(new Date(day.date));
        const dateSize = (d >= 5) ? 6.0 : 7.0;
        const dateWidth = helveticaFont.widthOfTextAtSize(dateStr, dateSize);
        const dateX = sigCenters[d] - (dateWidth / 2);
        page2.drawText(dateStr, { x: dateX, y: 255.5, size: dateSize, font: helveticaFont });
        
        if (activeOpName) {
          const maxW = cellWidths[d] - 2;
          const words = activeOpName.split(/\s+/).filter(Boolean);
          let nameLines = [];
          let nameSize = 5.5;

          if (words.length <= 2) {
            nameSize = (d >= 5) ? 6.0 : 7.0;
            const singleLineW = helveticaFont.widthOfTextAtSize(activeOpName, nameSize);
            if (singleLineW <= maxW) {
              nameLines = [activeOpName];
            } else {
              nameLines = words;
            }
          } else {
            nameSize = (d >= 5) ? 5.0 : 5.8;
            const line4 = words.slice(3).join(' ');
            nameLines = [words[0], words[1], words[2], line4].filter(Boolean);
          }

          const stepY = nameSize + 1.2;
          const cellCenterY = 221.0;
          const totalHeight = (nameLines.length - 1) * stepY;
          const startY = cellCenterY + (totalHeight / 2);

          nameLines.forEach((line, lineIdx) => {
            const lineWidth = helveticaFont.widthOfTextAtSize(line, nameSize);
            const lineX = sigCenters[d] - (lineWidth / 2);
            page2.drawText(line, { x: lineX, y: startY - lineIdx * stepY, size: nameSize, font: helveticaFont });
          });
        }
        
        if (embeddedSig) {
          const sigW = (d >= 5) ? 44 : 54;
          const sigH = sigW * 0.48;
          const sigX = sigCenters[d] - (sigW / 2);
          page2.drawImage(embeddedSig, {
            x: sigX,
            y: 179 - (sigH / 2),
            width: sigW,
            height: sigH
          });
        }
      }
    }
    
    return await pdfDoc.save();
  } catch (err) {
    console.error(err);
    alert("Error al procesar el PDF: " + err.message);
    return null;
  }
}

async function generatePdfForWeek(weekData) {
  const pdfBytes = await generatePdfBytesForWeek(weekData);
  if (!pdfBytes) return;
  
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Preoperacional_${weekData.placa.toUpperCase()}_Semana_${weekData.weekId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

async function sendWeekByEmail(weekData) {
  try {
    const pdfBytes = await generatePdfBytesForWeek(weekData);
    if (!pdfBytes) return;

    const fileName = `Preoperacional_${weekData.placa.toUpperCase()}_Semana_${weekData.weekId}.pdf`;
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

    const subject = `Preoperacional Semana ${weekData.weekId} - Placa ${weekData.placa.toUpperCase()}`;
    const bodyText = `Cordial saludo,\n\nAdjunto el registro preoperacional de la semana ${weekData.weekId} del vehículo con placa ${weekData.placa.toUpperCase()} (Área: ${weekData.area || 'General'}, Zona: ${weekData.zona}).\n\nAtentamente,\n${STATE.operatorName || 'Operador'}`;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (isMobile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        title: subject,
        text: bodyText,
        files: [pdfFile]
      });
      return;
    }

    // On PC: Download PDF and open Gmail web composer directly in new tab
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText + '\n\n(Nota: El archivo PDF ha sido descargado a tu computador. Selecciónalo al presionar el icono de clip "Adjuntar archivos" en Gmail).')}`;
    window.open(gmailUrl, '_blank');
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error(err);
      alert("Error al enviar el correo: " + err.message);
    }
  }
}

function dayDataActive(dayData) {
  return dayData.km !== null || Object.values(dayData.checklist).some(v => v !== null);
}

function isCanvasBlank(canvas) {
  const blank = document.createElement('canvas');
  blank.width = canvas.width;
  blank.height = canvas.height;
  return canvas.toDataURL() === blank.toDataURL();
}


// --- 14. Miscellaneous Utilities ---
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('Service Worker registrado con éxito', reg);
        reg.update();
      })
      .catch(err => console.warn('Error al registrar Service Worker', err));
  }
}

function updateOnlineStatus() {
  const badge = document.getElementById('offline-badge');
  if (navigator.onLine) {
    badge.style.display = 'none';
  } else {
    badge.style.display = 'block';
  }
}
