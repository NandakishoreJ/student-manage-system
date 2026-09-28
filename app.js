const studentsBody = document.querySelector('#studentsBody');
const searchInput = document.querySelector('#searchInput');
const courseFilter = document.querySelector('#courseFilter');
const modalBackdrop = document.querySelector('#modalBackdrop');
const form = document.querySelector('#studentForm');
let currentStudents = [];
let editingId = null;
let toastTimer;

async function api(url, options = {}) {
  const response = await fetch(url, {headers: {'Content-Type': 'application/json'}, ...options});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
}

function renderStudents(students) {
  currentStudents = students;
  studentsBody.innerHTML = students.map((student, index) => `<tr>
    <td><div class="student-cell"><div class="student-avatar avatar-${index % 5}">${escapeHtml(initials(student.full_name))}</div><div><strong>${escapeHtml(student.full_name)}</strong><small>${escapeHtml(student.phone || 'No phone added')}</small></div></div></td>
    <td><span class="roll-number">${escapeHtml(student.roll_number)}</span></td>
    <td><span class="course-pill">${escapeHtml(student.course)}</span></td>
    <td><span class="year-label">Year ${escapeHtml(student.year)}</span></td>
    <td><a class="email-link" href="mailto:${encodeURIComponent(student.email)}">${escapeHtml(student.email)}</a></td>
    <td><div class="row-actions"><button class="icon-button edit-button" data-action="edit" data-id="${student.id}" aria-label="Edit ${escapeHtml(student.full_name)}" title="Edit">✎</button><button class="icon-button delete-button" data-action="delete" data-id="${student.id}" aria-label="Delete ${escapeHtml(student.full_name)}" title="Delete">⌫</button></div></td>
  </tr>`).join('');
  document.querySelector('#emptyState').hidden = students.length > 0;
  document.querySelector('#totalStudents').textContent = currentAllCount;
  document.querySelector('#filteredStudents').textContent = students.length;
  document.querySelector('#tableSummary').textContent = `Showing ${students.length} ${students.length === 1 ? 'student' : 'students'}`;
}

let currentAllCount = 0;
async function refresh() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (courseFilter.value) params.set('course', courseFilter.value);
  const [students, courses, allStudents] = await Promise.all([
    api(`/api/students?${params}`), api('/api/courses'), api('/api/students')
  ]);
  const selectedCourse = courseFilter.value;
  courseFilter.innerHTML = '<option value="">All courses</option>' + courses.map(course => `<option value="${escapeHtml(course)}">${escapeHtml(course)}</option>`).join('');
  courseFilter.value = selectedCourse;
  currentAllCount = allStudents.length;
  document.querySelector('#totalCourses').textContent = courses.length;
  renderStudents(students);
}

function openModal(student = null) {
  editingId = student?.id ?? null;
  form.reset();
  document.querySelector('#formError').textContent = '';
  document.querySelector('#modalTitle').textContent = editingId ? 'Edit student' : 'Add student';
  document.querySelector('.modal-heading p').textContent = editingId ? 'Update the student details below.' : 'Enter the details below to create a student profile.';
  document.querySelector('#saveStudentBtn').textContent = editingId ? 'Save changes' : 'Save student';
  if (student) for (const [key, value] of Object.entries(student)) if (form.elements[key]) form.elements[key].value = value;
  modalBackdrop.hidden = false;
  document.body.classList.add('modal-open');
  form.elements.full_name.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.classList.remove('modal-open');
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

document.querySelector('#addStudentBtn').addEventListener('click', () => openModal());
document.querySelector('#closeModal').addEventListener('click', closeModal);
document.querySelector('#cancelModal').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', event => { if (event.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modalBackdrop.hidden) closeModal(); });
searchInput.addEventListener('input', () => { clearTimeout(searchInput.timer); searchInput.timer = setTimeout(() => refresh().catch(showError), 180); });
courseFilter.addEventListener('change', () => refresh().catch(showError));

studentsBody.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const student = currentStudents.find(item => item.id === Number(button.dataset.id));
  if (!student) return;
  if (button.dataset.action === 'edit') return openModal(student);
  if (window.confirm(`Delete ${student.full_name} (${student.roll_number})? This cannot be undone.`)) {
    try { await api(`/api/students/${student.id}`, {method: 'DELETE'}); await refresh(); showToast('Student deleted.'); }
    catch (error) { showError(error); }
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  data.year = Number(data.year);
  const button = document.querySelector('#saveStudentBtn');
  button.disabled = true;
  document.querySelector('#formError').textContent = '';
  try {
    await api(editingId ? `/api/students/${editingId}` : '/api/students', {
      method: editingId ? 'PUT' : 'POST', body: JSON.stringify(data)
    });
    closeModal();
    await refresh();
    showToast(editingId ? 'Student details updated.' : 'Student added successfully.');
  } catch (error) { document.querySelector('#formError').textContent = error.message; }
  finally { button.disabled = false; }
});

function showError(error) { showToast(error.message || 'Unable to load student records.'); }
refresh().catch(showError);
