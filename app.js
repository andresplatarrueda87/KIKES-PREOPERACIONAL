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

// --- 2. Database Initialization (Dexie.js) ---
const db = new Dexie('kikes_preop_db');
db.version(2).stores({
  weeks: 'id, dateStart, dateEnd, placa, finishedDaysCount',
  presets: '++id, placa, zona, area',
  operators: '++id, name',
  settings: 'key, value'
});

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

  // C. Load configurations
  await loadSettings();
  await renderOperatorsDropdown();
  
  // D. Populate Weeks Dropdown
  generateWeeksDropdown();
  
  // E. Setup UI Event Listeners
  setupNavigation();
  setupFormChangeHandlers();
  setupPresetsHandlers();
  setupDrawingPads();
  setupDataManagementHandlers();
  
  // F. Load Active Week Data
  await loadActiveWeekData();
});

// --- 5. Navigation & View Toggles ---
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-btn');
  const panels = document.querySelectorAll('.view-panel');
  
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPanelId = btn.getAttribute('data-target');
      
      navButtons.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const targetPanel = document.getElementById(targetPanelId);
      targetPanel.classList.add('active');
      
      // Load view specific data
      if (targetPanelId === 'panel-historico') {
        renderHistoryList();
      } else if (targetPanelId === 'panel-ajustes') {
        renderPresetsList();
        renderOperatorsList();
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

function initNewWeekData(weekId, placa, zona, area, tipo, hasFuelIndicator) {
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
    // Disable form fields if no plate is provided
    document.getElementById('tab-bar-days').style.opacity = '0.4';
    document.getElementById('tab-bar-days').style.pointerEvents = 'none';
    document.querySelector('.day-form-container').style.opacity = '0.4';
    document.querySelector('.day-form-container').style.pointerEvents = 'none';
    document.getElementById('btn-save-week').disabled = true;
    document.getElementById('btn-fill-week').disabled = true;
    return;
  }
  
  // Enable form
  document.getElementById('tab-bar-days').style.opacity = '1';
  document.getElementById('tab-bar-days').style.pointerEvents = 'auto';
  document.querySelector('.day-form-container').style.opacity = '1';
  document.querySelector('.day-form-container').style.pointerEvents = 'auto';
  document.getElementById('btn-save-week').disabled = false;
  document.getElementById('btn-fill-week').disabled = false;
  
  // Check preset and last record for fuel indicator priority
  const preset = await db.presets.where('placa').equalsIgnoreCase(placa).first();
  const lastActiveRecord = await db.weeks.where('placa').equals(placa).first();
  
  let hasFuel = true;
  if (preset && typeof preset.hasFuelIndicator === 'boolean') {
    hasFuel = preset.hasFuelIndicator;
  } else if (lastActiveRecord && typeof lastActiveRecord.hasFuelIndicator === 'boolean') {
    hasFuel = lastActiveRecord.hasFuelIndicator;
  }
  
  const searchId = `${weekId}-${placa}`;
  let weekData = await db.weeks.get(searchId);
  
  if (!weekData) {
    const finalArea = area || (lastActiveRecord ? lastActiveRecord.area : (preset ? preset.area : ''));
    const finalZona = lastActiveRecord ? lastActiveRecord.zona : (preset ? preset.zona : zona);
    const finalTipo = lastActiveRecord ? (lastActiveRecord.tipo || 'Moto') : (preset ? (preset.tipo || 'Moto') : tipo);
    
    document.getElementById('meta-area').value = finalArea;
    document.getElementById('meta-zona').value = finalZona;
    document.getElementById('meta-tipo').value = finalTipo;
    document.getElementById('meta-has-fuel').value = hasFuel ? '1' : '0';
    STATE.hasFuelIndicator = hasFuel;
    
    weekData = initNewWeekData(weekId, placa, finalZona, finalArea, finalTipo, hasFuel);
  } else {
    // If weekData exists, preset configuration still overrides if available
    if (preset && typeof preset.hasFuelIndicator === 'boolean') {
      hasFuel = preset.hasFuelIndicator;
    } else if (typeof weekData.hasFuelIndicator === 'boolean') {
      hasFuel = weekData.hasFuelIndicator;
    }
    
    document.getElementById('meta-zona').value = weekData.zona;
    document.getElementById('meta-area').value = weekData.area;
    document.getElementById('meta-tipo').value = weekData.tipo || 'Moto';
    document.getElementById('meta-has-fuel').value = hasFuel ? '1' : '0';
    STATE.hasFuelIndicator = hasFuel;
    weekData.hasFuelIndicator = hasFuel;
  }
  
  // Force fuel = 'N/A' across all 7 days if vehicle has no fuel indicator
  if (!STATE.hasFuelIndicator) {
    weekData.days.forEach(d => { d.fuel = 'N/A'; });
  }
  
  STATE.activeWeekData = weekData;
  renderActiveDayData();
  updatePrevKmButtonContainer();
}

function saveCurrentActiveDayToState() {
  if (!STATE.activeWeekData) return;
  
  const dayData = STATE.activeWeekData.days[STATE.activeDayIndex];
  
  // Save Kilometraje
  const kmInput = document.getElementById('day-km').value;
  dayData.km = kmInput ? parseFloat(kmInput) : null;
  
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
    loadActiveWeekData();
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
    }
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
      // 3. Estimate Km (increase by 15-30km daily)
      if (dayData.km === null) {
        dayData.km = baseKm + (idx * 20);
      }
    });
    
    renderActiveDayData();
    alert("Semana completada exitosamente con valores conforme. Recuerde guardar su progreso.");
  });
  
  // "Guardar Progreso de la Semana"
  document.getElementById('btn-save-week').addEventListener('click', async () => {
    if (!STATE.activeWeekData) return;
    
    saveCurrentActiveDayToState();
    STATE.activeWeekData.tipo = document.getElementById('meta-tipo').value;
    STATE.activeWeekData.hasFuelIndicator = (document.getElementById('meta-has-fuel').value === '1');
    
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
    
    try {
      await db.weeks.put(STATE.activeWeekData);
      alert("Progreso guardado localmente de forma exitosa.");
    } catch (e) {
      console.error(e);
      alert("Error al guardar en base de datos local: " + e.message);
    }
  });

  // "Generar PDF" (Main button)
  document.getElementById('btn-generate-pdf-main').addEventListener('click', async () => {
    const placa = document.getElementById('meta-placa').value.trim();
    if (!placa) {
      alert("Debe ingresar la placa del vehículo para generar el PDF.");
      return;
    }
    await loadActiveWeekData();
    saveCurrentActiveDayToState();
    if (STATE.activeWeekData) {
      STATE.activeWeekData.tipo = document.getElementById('meta-tipo').value;
      STATE.activeWeekData.hasFuelIndicator = (document.getElementById('meta-has-fuel').value === '1');
      await db.weeks.put(STATE.activeWeekData);
      await generatePdfForWeek(STATE.activeWeekData);
    }
  });

  // "Enviar por Correo" (Main button)
  document.getElementById('btn-send-email-main').addEventListener('click', async () => {
    const placa = document.getElementById('meta-placa').value.trim();
    if (!placa) {
      alert("Debe ingresar la placa del vehículo para enviar por correo.");
      return;
    }
    await loadActiveWeekData();
    saveCurrentActiveDayToState();
    if (STATE.activeWeekData) {
      STATE.activeWeekData.tipo = document.getElementById('meta-tipo').value;
      STATE.activeWeekData.hasFuelIndicator = (document.getElementById('meta-has-fuel').value === '1');
      await db.weeks.put(STATE.activeWeekData);
      await sendWeekByEmail(STATE.activeWeekData);
    }
  });
}

// --- 9. Presets & Default Configuration Management ---
async function setupPresetsHandlers() {
  // Add operator button from Settings
  document.getElementById('btn-save-sig').addEventListener('click', async () => {
    const name = document.getElementById('settings-op-name').value.trim();
    const canvas = document.getElementById('signature-canvas');
    
    if (!name) {
      alert("Debe ingresar el nombre del operador.");
      return;
    }
    
    const sigData = canvas.toDataURL('image/png');
    
    // Check if canvas signature is blank
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (sigData === blank.toDataURL()) {
      alert("Debe dibujar la firma del operador.");
      return;
    }
    
    await db.operators.add({ name, signature: sigData });
    
    document.getElementById('settings-op-name').value = '';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    alert("Operador guardado exitosamente.");
    renderOperatorsList();
    renderOperatorsDropdown();
  });

  // Select Operator Event on Registrar panel
  document.getElementById('select-operador-activo').addEventListener('change', async (e) => {
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
      
      lockActiveSignature(true); // Lock editing when preloading signature
      document.getElementById('select-operador-activo').value = ''; // Reset dropdown
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
    const placa = document.getElementById('preset-placa').value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const tipo = document.getElementById('preset-tipo').value;
    const zona = document.getElementById('preset-zona').value;
    const area = document.getElementById('preset-area').value.trim();
    const hasFuelIndicator = document.getElementById('preset-has-fuel').value === '1';
    
    if (!placa) {
      alert("Debe ingresar la placa del vehículo.");
      return;
    }
    
    await db.presets.add({ placa, tipo, zona, area, hasFuelIndicator });
    
    document.getElementById('preset-placa').value = '';
    document.getElementById('preset-tipo').value = 'Moto';
    document.getElementById('preset-area').value = '';
    document.getElementById('preset-has-fuel').value = '1';
    
    renderPresetsList();
    renderPresetsDropdown();
  });
  
  // Select Preset Event
  document.getElementById('select-preset').addEventListener('change', async (e) => {
    const presetId = e.target.value;
    if (!presetId) return;
    
    const preset = await db.presets.get(parseInt(presetId));
    if (preset) {
      document.getElementById('meta-placa').value = preset.placa;
      document.getElementById('meta-tipo').value = preset.tipo || 'Moto';
      document.getElementById('meta-zona').value = preset.zona;
      document.getElementById('meta-area').value = preset.area;
      document.getElementById('meta-has-fuel').value = (preset.hasFuelIndicator !== false) ? '1' : '0';
      STATE.hasFuelIndicator = (preset.hasFuelIndicator !== false);
      
      await loadActiveWeekData();
      document.getElementById('select-preset').value = ''; // Reset dropdown
    }
  });
  
  renderPresetsDropdown();
}

async function renderPresetsList() {
  const container = document.getElementById('presets-list');
  container.innerHTML = '';
  
  const list = await db.presets.toArray();
  if (list.length === 0) {
    container.innerHTML = '<p class="helper-text">No hay perfiles configurados. Añada uno abajo.</p>';
    return;
  }
  
  list.forEach(p => {
    const div = document.createElement('div');
    div.className = 'preset-card';
    const fuelText = (p.hasFuelIndicator !== false) ? 'Gasolina: SÍ' : 'Gasolina: NO (N/A)';
    const tipoText = p.tipo || 'Moto';
    div.innerHTML = `
      <div class="preset-info">
        <span class="preset-title">${p.placa}</span> (${tipoText}) | ${p.zona} - ${p.area} | <span style="font-weight: 500; font-size: 11px; color: var(--text-secondary);">${fuelText}</span>
      </div>
      <button class="btn btn-danger btn-sm btn-delete-preset" data-id="${p.id}">Eliminar</button>
    `;
    
    div.querySelector('.btn-delete-preset').addEventListener('click', async () => {
      if (confirm(`¿Eliminar perfil de placa ${p.placa}?`)) {
        await db.presets.delete(p.id);
        renderPresetsList();
        renderPresetsDropdown();
      }
    });
    
    container.appendChild(div);
  });
}

async function renderPresetsDropdown() {
  const dropdown = document.getElementById('select-preset');
  dropdown.innerHTML = '<option value="">-- Cargar Perfil Rápido --</option>';
  
  const list = await db.presets.toArray();
  list.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    const labelArea = p.area ? p.area : (p.zona || 'Perfil');
    opt.text = `${p.placa} (${labelArea})`;
    dropdown.appendChild(opt);
  });
}

async function renderOperatorsList() {
  const container = document.getElementById('operators-list');
  container.innerHTML = '';
  
  const list = await db.operators.toArray();
  if (list.length === 0) {
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
        renderOperatorsList();
        renderOperatorsDropdown();
      }
    });
    
    container.appendChild(div);
  });
}

async function renderOperatorsDropdown() {
  const dropdown = document.getElementById('select-operador-activo');
  dropdown.innerHTML = '<option value="">-- Cargar Operador --</option>';
  
  const list = await db.operators.toArray();
  list.forEach(op => {
    const opt = document.createElement('option');
    opt.value = op.id;
    opt.text = op.name;
    dropdown.appendChild(opt);
  });
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
  
  weeksArray.forEach(week => {
    const dates = getWeekDates(week.weekId);
    const card = document.createElement('div');
    card.className = 'card history-card';
    card.innerHTML = `
      <div class="history-header">
        <span class="history-placa">${week.placa}</span>
        <span class="history-dates">${formatDateShort(dates[0])} - ${formatDateShort(dates[6])}</span>
      </div>
      <div class="history-details">
        <span class="detail-badge">Tipo: ${week.tipo || 'Moto'}</span>
        <span class="detail-badge">Zona: ${week.zona}</span>
        <span class="detail-badge">Área: ${week.area || 'Sin área'}</span>
        <span class="detail-badge">Días Registrados: ${week.finishedDaysCount}/7</span>
      </div>
      <div class="history-actions">
        <button class="btn btn-secondary btn-sm btn-edit-hist" data-id="${week.id}">Editar</button>
        <button class="btn btn-accent btn-sm btn-pdf-hist" data-id="${week.id}">Generar PDF</button>
        <button class="btn btn-sm btn-email-hist" data-id="${week.id}" style="background-color: #ea4335; color: #ffffff; border: none; font-weight: 500;">✉️ Correo</button>
        <button class="btn btn-danger btn-sm btn-delete-hist" data-id="${week.id}">Eliminar</button>
      </div>
    `;
    
    // Wire button events
    card.querySelector('.btn-edit-hist').addEventListener('click', async () => {
      document.getElementById('select-semana').value = week.weekId;
      document.getElementById('meta-placa').value = week.placa;
      document.getElementById('meta-tipo').value = week.tipo || 'Moto';
      document.getElementById('meta-zona').value = week.zona;
      document.getElementById('meta-area').value = week.area;
      document.getElementById('meta-has-fuel').value = (week.hasFuelIndicator !== false) ? '1' : '0';
      STATE.hasFuelIndicator = (week.hasFuelIndicator !== false);
      
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
        
        alert("Restauración completada con éxito.");
        await loadSettings();
        await renderOperatorsDropdown();
        await renderPresetsDropdown();
        await renderPresetsList();
        await loadActiveWeekData(); // Reload active week inputs and layout
      } catch (err) {
        alert("Error al importar el archivo. El formato JSON no es válido.");
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
    
    alert("Base de datos borrada exitosamente.");
    window.location.reload();
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
      .then(reg => console.log('Service Worker registrado con éxito', reg))
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
