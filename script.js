// CONFIGURATION ENGINE ARCHITECTURE
const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? "http://localhost:5000/api"
  : "https://YOUR-RAILWAY-BACKEND-URL-GOES-HERE.up.railway.app/api"; // Swap this placeholder on live server sync

let globalEngineState = { teachers: [], rooms: [], groups: [], timeSlots: [], lessons: [] };

async function executeApplicationInit() {
  await synchroniseStateMatrix();
  renderControlPulseCounters();
  populateInterfaceFilterChannels();
  renderInfrastructureOccupancyMap();
  renderDynamicScheduleSpreadsheet();
  renderResourceKatalog();

  ['filter-day', 'filter-teacher', 'filter-level', 'filter-room-table'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderDynamicScheduleSpreadsheet);
  });
  document.getElementById('free-teacher-select').addEventListener('change', executeTeacherDiagnostic);
}

async function synchroniseStateMatrix() {
  try {
    const [t, r, g, ts, l] = await Promise.all([
      fetch(`${API_BASE}/teachers`).then(res => res.json()),
      fetch(`${API_BASE}/rooms`).then(res => res.json()),
      fetch(`${API_BASE}/groups`).then(res => res.json()),
      fetch(`${API_BASE}/time_slots`).then(res => res.json()),
      fetch(`${API_BASE}/lessons`).then(res => res.json())
    ]);
    globalEngineState = { teachers: t, rooms: r, groups: g, timeSlots: ts, lessons: l };
  } catch (error) {
    console.error("[STATE ERROR] Synchronization vectors failed to establish contact:", error);
  }
}

function renderControlPulseCounters() {
  document.getElementById('stat-groups').textContent = `${globalEngineState.groups.length} ta`;
  document.getElementById('stat-teachers').textContent = `${globalEngineState.teachers.length} nafar`;
  document.getElementById('stat-lessons').textContent = `${globalEngineState.lessons.length} dars / haftalik`;

  const dynamicCapacityTotal = globalEngineState.rooms.length * globalEngineState.timeSlots.length * 6;
  const loadPercentage = dynamicCapacityTotal > 0 ? Math.round((globalEngineState.lessons.length / dynamicCapacityTotal) * 100) : 0;
  document.getElementById('stat-occupancy').textContent = `${loadPercentage}%`;
}

function populateInterfaceFilterChannels() {
  const teacherSelect = document.getElementById('filter-teacher');
  const roomSelect = document.getElementById('filter-room-table');
  const analyticTeacherSelect = document.getElementById('free-teacher-select');

  globalEngineState.teachers.forEach(teacher => {
    const optionMarkup = `<option value="${teacher.id}">${teacher.name}</option>`;
    teacherSelect.innerHTML += optionMarkup;
    analyticTeacherSelect.innerHTML += optionMarkup;
  });

  globalEngineState.rooms.forEach(room => {
    roomSelect.innerHTML += `<option value="${room.id}">${room.name}</option>`;
  });
}

function renderInfrastructureOccupancyMap() {
  const container = document.getElementById('occupancy-container');
  container.innerHTML = '';

  globalEngineState.rooms.forEach(room => {
    const totalAssignedLessons = globalEngineState.lessons.filter(l => l.room_id === room.id).length;
    const roomStructuralLimit = globalEngineState.timeSlots.length * 6;
    const occupancyFactor = Math.round((totalAssignedLessons / roomStructuralLimit) * 100) || 0;

    let visualClass = 'low-occupancy';
    if (occupancyFactor > 35) visualClass = 'mid-occupancy';
    if (occupancyFactor > 75) visualClass = 'high-occupancy';

    container.innerHTML += `
      <div class="badge-occupancy ${visualClass}">
        <div style="font-size: 1.1rem; font-weight: 800; margin-bottom:4px;">${room.name}</div>
        <div style="font-size: 0.85rem; font-weight: 600; opacity: 0.9;">
          Yuklama: ${occupancyFactor}% (${totalAssignedLessons}/${roomStructuralLimit} Slotlar)
        </div>
      </div>
    `;
  });
}

function renderDynamicScheduleSpreadsheet() {
  const fDay = document.getElementById('filter-day').value;
  const fTeacher = document.getElementById('filter-teacher').value;
  const fLevel = document.getElementById('filter-level').value;
  const fRoom = document.getElementById('filter-room-table').value;

  const weekdayArray = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  document.getElementById('table-header').innerHTML = '<th>Vaqt Mezonlari</th>' + weekdayArray.map(day => `<th>${day}</th>`).join('');

  const tableBody = document.getElementById('table-body');
  tableBody.innerHTML = '';

  globalEngineState.timeSlots.forEach(slot => {
    let rowHTML = `<td><span style="font-weight: 800; color:#fff;">${slot.start} - ${slot.end}</span></td>`;

    weekdayArray.forEach(day => {
      let filteredLessons = globalEngineState.lessons.filter(l => l.day === day && l.time_slot_id === slot.id);

      if (fDay && day !== fDay) filteredLessons = [];
      if (fTeacher) filteredLessons = filteredLessons.filter(l => String(l.teacher_id) === fTeacher);
      if (fLevel) filteredLessons = filteredLessons.filter(l => l.group_level === fLevel);
      if (fRoom) filteredLessons = filteredLessons.filter(l => String(l.room_id) === fRoom);

      let slotCellMarkup = '';
      filteredLessons.forEach(lesson => {
        slotCellMarkup += `
          <div class="schedule-block">
            <div style="font-size:0.95rem; font-weight:800; color:#fff;">${lesson.group_name}</div>
            <div style="margin: 4px 0;"><span class="level-tag">${lesson.group_level}</span></div>
            <div style="color:var(--text-muted);">👨‍🏫 Ism: ${lesson.teacher_name}</div>
            <div style="color:var(--text-muted);">🚪 Xona: ${lesson.room_name}</div>
            <div style="font-size:0.75rem; color:var(--brand); margin-top:4px;">📚 Resurs: ${lesson.resource_book}</div>
          </div>
        `;
      });
      rowHTML += `<td>${slotCellMarkup}</td>`;
    });
    tableBody.innerHTML += `<tr>${rowHTML}</tr>`;
  });
}

async function executeTeacherDiagnostic() {
  const teacherId = document.getElementById('free-teacher-select').value;
  const diagnosticOutput = document.getElementById('free-slots-output');
  diagnosticOutput.innerHTML = '';

  if (!teacherId) return;

  try {
    const availabilityPayload = await fetch(`${API_BASE}/freetimes/${teacherId}`).then(res => res.json());
    availabilityPayload.forEach(dataBlock => {
      let tagsHTML = dataBlock.slots.map(s => `<span class="free-slot-tag">${s.start} - ${s.end}</span>`).join('');
      if (!tagsHTML) tagsHTML = `<span style="color:var(--danger); font-size:0.8rem; font-weight:700;">To'liq band</span>`;

      diagnosticOutput.innerHTML += `
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--border); padding-bottom:6px;">
          <span style="font-weight:700; font-size:0.9srem; min-width:90px;">${dataBlock.day}:</span>
          <div style="text-align:right;">${tagsHTML}</div>
        </div>
      `;
    });
  } catch (error) {
    diagnosticOutput.innerHTML = `<span style="color:var(--danger);">Diagnostika ma'lumotlarini yuklashda xatolik!</span>`;
  }
}

function renderResourceKatalog() {
  const catalogList = document.getElementById('groups-list');
  catalogList.innerHTML = globalEngineState.groups.map(group => `
    <li>
      <div>
        <strong style="color:#fff; font-size:1rem;">${group.name}</strong> 
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Yo'nalish: ${group.type}</div>
      </div>
      <div style="text-align:right;">
        <span class="level-tag" style="margin-bottom:4px;">${group.level}</span>
        <div style="font-size:0.8rem; font-style:italic; color:var(--brand);">📖 ${group.resource_book}</div>
      </div>
    </li>
  `).join('');
}

window.addEventListener('DOMContentLoaded', executeApplicationInit);