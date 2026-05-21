// CONFIGURATION ENGINE ARCHITECTURE
const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? "http://localhost:5000/api"
  : "https://YOUR-RAILWAY-BACKEND-URL-GOES-HERE.up.railway.app/api"; // Swap this placeholder on live server sync

document.getElementById('attendance-date').valueAsDate = new Date();

let internalAdminState = { teachers: [], rooms: [], groups: [], timeSlots: [], lessons: [], attendance: [] };

async function verifyGatekeeperAuthorization() {
  try {
    const verificationStream = await fetch(`${API_BASE}/auth/status`).then(res => res.json());
    if (verificationStream.isAdmin) {
      document.getElementById('login-overlay').style.display = 'none';
      await initializeAdminWorkspace();
    }
  } catch (e) {
    console.error("[SECURITY AUTH CHANNELS CONTACT FAILURE]");
  }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorAlert = document.getElementById('login-error');
  errorAlert.style.display = 'none';

  try {
    const authQuery = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
      })
    });

    if (authQuery.ok) {
      document.getElementById('login-overlay').style.display = 'none';
      await initializeAdminWorkspace();
    } else {
      const errorContext = await authQuery.json();
      errorAlert.textContent = errorContext.error || 'Kirish taqiqlandi!';
      errorAlert.style.display = 'block';
    }
  } catch (err) {
    errorAlert.textContent = 'Server bilan aloqa uzildi!';
    errorAlert.style.display = 'block';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  window.location.reload();
});

async function initializeAdminWorkspace() {
  await executeAdminDatasetFetch();
  renderAdministrativeInterfaces();
  bindFormInterceptors();
  document.getElementById('attendance-date').addEventListener('change', renderAdministrativeInterfaces);
}

async function executeAdminDatasetFetch() {
  try {
    const [t, r, g, ts, l, att] = await Promise.all([
      fetch(`${API_BASE}/teachers`).then(res => res.json()),
      fetch(`${API_BASE}/rooms`).then(res => res.json()),
      fetch(`${API_BASE}/groups`).then(res => res.json()),
      fetch(`${API_BASE}/time_slots`).then(res => res.json()),
      fetch(`${API_BASE}/lessons`).then(res => res.json()),
      fetch(`${API_BASE}/attendance`).then(res => res.json())
    ]);
    internalAdminState = { teachers: t, rooms: r, groups: g, timeSlots: ts, lessons: l, attendance: att };
  } catch (err) {
    console.error("[CRITICAL CAPTURE ERROR] Administrative state maps failed to compile.", err);
  }
}

function renderAdministrativeInterfaces() {
  document.getElementById('lesson-slot').innerHTML = internalAdminState.timeSlots.map(s => `<option value="${s.id}">${s.start} - ${s.end}</option>`).join('');
  document.getElementById('lesson-room').innerHTML = internalAdminState.rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  document.getElementById('lesson-group').innerHTML = internalAdminState.groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  document.getElementById('lesson-teacher').innerHTML = internalAdminState.teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  document.getElementById('admin-teachers-list').innerHTML = internalAdminState.teachers.map(t => `
    <li><span><strong>${t.name}</strong> <span style="color:var(--text-muted); font-size:0.8rem;">(${t.language})</span></span> 
    <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="eliminateStructuralEntity('teachers', ${t.id})">O'chirish</button></li>
  `).join('');

  document.getElementById('admin-rooms-list').innerHTML = internalAdminState.rooms.map(r => `
    <li><span><strong>${r.name}</strong></span> 
    <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="eliminateStructuralEntity('rooms', ${r.id})">O'chirish</button></li>
  `).join('');

  document.getElementById('admin-groups-list').innerHTML = internalAdminState.groups.map(g => `
    <li><span><strong>${g.name}</strong> <span class="level-tag">${g.level}</span></span> 
    <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="eliminateStructuralEntity('groups', ${g.id})">O'chirish</button></li>
  `).join('');

  const targetDateStamp = document.getElementById('attendance-date').value;
  const recordsBody = document.getElementById('admin-lessons-table');
  recordsBody.innerHTML = '';

  internalAdminState.lessons.forEach(lesson => {
    const historicalMatch = internalAdminState.attendance.find(a => a.lesson_id === lesson.id && a.date === targetDateStamp);
    const activeStatus = historicalMatch ? historicalMatch.status : 'Belgilanmagan';
    
    let statusColor = 'var(--text-muted)';
    if(activeStatus === 'Keldi') statusColor = 'var(--success)';
    if(activeStatus === 'Kelmadi') statusColor = 'var(--danger)';

    recordsBody.innerHTML += `
      <tr>
        <td><strong style="color:#fff;">${lesson.day}</strong><br><span style="color:var(--text-muted); font-size:0.85rem;">${lesson.start} - ${lesson.end}</span></td>
        <td><span style="font-weight:700;">${lesson.room_name}</span></td>
        <td><strong>${lesson.group_name}</strong><br><span class="level-tag" style="margin-top:4px;">${lesson.group_level}</span></td>
        <td>${lesson.teacher_name}</td>
        <td><span style="font-size:0.8rem; color:var(--brand); font-style:italic;">📖 ${lesson.resource_book}</span></td>
        <td><span style="font-weight:800; color:${statusColor}">${activeStatus}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-success" style="padding:6px 10px; font-size:0.75rem;" onclick="commitAttendanceMetric(${lesson.id}, 'Keldi')">Keldi</button>
            <button class="btn btn-danger" style="padding:6px 10px; font-size:0.75rem;" onclick="commitAttendanceMetric(${lesson.id}, 'Kelmadi')">Kelmadi</button>
            <button class="btn" style="background:#475569; color:#fff; padding:6px 10px; font-size:0.75rem;" onclick="eliminateStructuralEntity('lessons', ${lesson.id})">O'chirish</button>
          </div>
        </td>
      </tr>
    `;
  });
}

function bindFormInterceptors() {
  document.getElementById('teacher-form').onsubmit = async (e) => {
    e.preventDefault();
    await dispatchWritePayload('/teachers', {
      name: document.getElementById('teacher-name').value,
      language: document.getElementById('teacher-lang').value
    });
    document.getElementById('teacher-form').reset();
    await initializeAdminWorkspace();
  };

  document.getElementById('room-form').onsubmit = async (e) => {
    e.preventDefault();
    const nameVal = document.getElementById('room-name').value;
    await dispatchWritePayload('/rooms', { name: nameVal });
    document.getElementById('room-form').reset();
    await initializeAdminWorkspace();
  };

  document.getElementById('group-form').onsubmit = async (e) => {
    e.preventDefault();
    await dispatchWritePayload('/groups', {
      name: document.getElementById('group-name').value,
      type: document.getElementById('group-type').value,
      level: document.getElementById('group-level').value,
      resource_book: document.getElementById('group-book').value
    });
    document.getElementById('group-form').reset();
    await initializeAdminWorkspace();
  };

  document.getElementById('lesson-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const scheduleTransaction = await fetch(`${API_BASE}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day: document.getElementById('lesson-day').value,
          time_slot_id: parseInt(document.getElementById('lesson-slot').value),
          room_id: parseInt(document.getElementById('lesson-room').value),
          group_id: parseInt(document.getElementById('lesson-group').value),
          teacher_id: parseInt(document.getElementById('lesson-teacher').value)
        })
      });

      if (!scheduleTransaction.ok) {
        const structuralConflictPayload = await scheduleTransaction.json();
        alert(`❌ REJALASHTIRISH XATOLIGI:\n\n${structuralConflictPayload.error}`);
      } else {
        await initializeAdminWorkspace();
      }
    } catch (err) {
      alert('Tizim xatoligi yuz berdi.');
    }
  };
}

async function commitAttendanceMetric(lessonId, statusString) {
  await dispatchWritePayload('/attendance', {
    lesson_id: lessonId,
    date: document.getElementById('attendance-date').value,
    status: statusString
  });
  await initializeAdminWorkspace();
}

async function eliminateStructuralEntity(endpointChannel, trackingId) {
  if (confirm('Ushbu ma\'lumotni o\'chirishni tasdiqlaysizmi? Bu amal orqaga qaytarilmaydi!')) {
    try {
      const deletionStream = await fetch(`${API_BASE}/${endpointChannel}/${trackingId}`, { method: 'DELETE' });
      if(!deletionStream.ok) {
        const errorMsg = await deletionStream.json();
        alert(errorMsg.error);
      }
      await initializeAdminWorkspace();
    } catch (e) {
      alert('O\'chirishda xatolik yuz berdi.');
    }
  }
}

async function dispatchWritePayload(urlExtension, dataBody) {
  try {
    const postStream = await fetch(`${API_BASE}${urlExtension}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataBody)
    });
    if(!postStream.ok) {
      const errorMsg = await postStream.json();
      alert(errorMsg.error);
    }
  } catch (e) {
    console.error('[WRITE SYSTEM ERR]', e);
  }
}

window.addEventListener('DOMContentLoaded', verifyGatekeeperAuthorization);