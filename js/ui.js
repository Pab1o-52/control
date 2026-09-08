/**
 * ui.js — управление интерфейсом (форма, список заявок, модалки, тосты)
 */

// Цвета типов контроля
const TYPE_COLORS = {
  Вик: '#00FF88',
  Узк: '#FF6B6B',
  Рк: '#FFD93D',
  Цд: '#6C5CE7',
};

// Кэш DOM-элементов
const el = {};

function cacheElements() {
  el.requestsList = document.getElementById('requests-list');
  el.emptyState = document.getElementById('empty-state');
  el.searchInput = document.getElementById('search-input');
  el.filterBox = document.getElementById('filter-box');
  el.statTotal = document.getElementById('stat-total');
  el.cntVik = document.getElementById('cnt-vik');
  el.cntUzk = document.getElementById('cnt-uzk');
  el.cntRk = document.getElementById('cnt-rk');
  el.cntCd = document.getElementById('cnt-cd');

  el.form = document.getElementById('request-form');
  el.formTitle = document.getElementById('form-title');
  el.fObjectName = document.getElementById('f-objectName');
  el.fControlType = document.getElementById('f-controlType');
  el.fJointNumber = document.getElementById('f-jointNumber');
  el.fDiameter = document.getElementById('f-diameter');
  el.fThickness = document.getElementById('f-thickness');
  el.fSteelGrade = document.getElementById('f-steelGrade');
  el.fWelderId = document.getElementById('f-welderId');
  el.fDescription = document.getElementById('f-description');
  el.fContactPerson = document.getElementById('f-contactPerson');
  el.fStatus = document.getElementById('f-status');
  el.fCreatedAt = document.getElementById('f-createdAt');
  el.fAuthor = document.getElementById('f-author');
  el.btnSubmit = document.getElementById('btn-submit');
  el.btnCancelEdit = document.getElementById('btn-cancel-edit');

  el.modalUser = document.getElementById('modal-user');
  el.inputUsername = document.getElementById('input-username');
  el.btnSaveUsername = document.getElementById('btn-save-username');
  el.userNameSpan = document.getElementById('user-name');
  el.btnChangeUser = document.getElementById('btn-change-user');

  el.modalConfirm = document.getElementById('modal-confirm');
  el.confirmText = document.getElementById('confirm-text');
  el.btnConfirmDelete = document.getElementById('btn-confirm-delete');
  el.btnCancelDelete = document.getElementById('btn-cancel-delete');

  el.modalApprove = document.getElementById('modal-approve');
  el.approveText = document.getElementById('approve-text');
  el.inputApproveInspector = document.getElementById('input-approve-inspector');
  el.btnConfirmApprove = document.getElementById('btn-confirm-approve');
  el.btnCancelApprove = document.getElementById('btn-cancel-approve');

  el.modalReject = document.getElementById('modal-reject');
  el.inputDefectReason = document.getElementById('input-defect-reason');
  el.btnConfirmReject = document.getElementById('btn-confirm-reject');
  el.btnCancelReject = document.getElementById('btn-cancel-reject');

  el.toastContainer = document.getElementById('toast-container');
  el.mapHint = document.getElementById('map-hint');
}

/** Экранирование текста перед вставкой в innerHTML */
function escapeHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Форматирует ISO-дату в читаемый вид ДД.ММ.ГГГГ ЧЧ:MM */
function formatDate(isoString) {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '—';
  }
}

/** Возвращает иконку Font Awesome для типа контроля */
function typeIconClass(type) {
  const map = { Вик: 'fa-eye', Узк: 'fa-wave-square', Рк: 'fa-radiation', Цд: 'fa-magnifying-glass' };
  return map[type] || 'fa-tag';
}

/** Строит HTML одной карточки заявки (ВМЕСТО ХЕША — ОПИСАНИЕ) */
function buildCardHtml(request, isActive, isGuest) {
  let statusClass = 'st-new';
  if (request.status === 'В работе') statusClass = 'st-work';
  else if (request.status === 'Завершена') statusClass = 'st-done';

  let verdictHtml = '';
  if (request.approved === true) {
    const inspectorText = request.approvedBy ? ` · ${escapeHtml(request.approvedBy)}` : '';
    verdictHtml = `<span class="verdict approved" title="${escapeHtml(request.approvedBy || '')}"><i class="fa-solid fa-check"></i> ГОДЕН${inspectorText}</span>`;
  } else if (request.approved === false) {
    const inspectorText = request.rejectedBy ? ` · ${escapeHtml(request.rejectedBy)}` : '';
    verdictHtml = `<span class="verdict rejected" title="${escapeHtml(request.rejectedBy || '')}"><i class="fa-solid fa-xmark"></i> НЕ ГОДЕН${inspectorText}</span>`;
  }
  
  let defectReasonHtml = '';
  if (request.approved === false && request.defectReason) {
    defectReasonHtml = `<div class="rc-defect"><i class="fa-solid fa-triangle-exclamation"></i> Дефект: ${escapeHtml(request.defectReason)}</div>`;
  }

  const descHtml = request.description ? `<div class="rc-desc"><i class="fa-solid fa-align-left"></i> ${escapeHtml(request.description)}</div>` : '';
  const contactHtml = request.contactPerson ? `<div class="rc-contact"><i class="fa-solid fa-id-card"></i> ${escapeHtml(request.contactPerson)}</div>` : '';
  
  // Новые поля
  const jointHtml = request.jointNumber ? `Стык: <b>${escapeHtml(request.jointNumber)}</b>` : '';
  const dimsHtml = (request.diameter || request.thickness) ? `Размер: <b>Ø${escapeHtml(request.diameter || '-')}x${escapeHtml(request.thickness || '-')}</b>` : '';
  const welderHtml = request.welderId ? `Клеймо: <b>${escapeHtml(request.welderId)}</b>` : '';
  
  let specInfoHtml = '';
  if (jointHtml || dimsHtml || welderHtml) {
    specInfoHtml = `<div class="rc-spec-info">
      ${jointHtml ? `<span>${jointHtml}</span>` : ''}
      ${dimsHtml ? `<span>${dimsHtml}</span>` : ''}
      ${welderHtml ? `<span>${welderHtml}</span>` : ''}
    </div>`;
  }

  // Действия голосования: гости не могут голосовать/признавать годным/браковать
  const actionsHtml = isGuest ? '' : `
    <div class="rc-actions">
      <button class="btn-vote btn-approve" data-id="${request.id}" type="button"><i class="fa-solid fa-check"></i> Годен</button>
      <button class="btn-vote btn-reject" data-id="${request.id}" type="button"><i class="fa-solid fa-xmark"></i> Не годен</button>
    </div>
  `;

  // Кнопка удаления: гости не могут удалять заявки
  const delHtml = isGuest ? '' : `
    <button class="rc-del" data-id="${request.id}" title="Удалить заявку">
      <i class="fa-solid fa-trash"></i>
    </button>
  `;

  return `
    <div class="request-card type-${escapeHtml(request.controlType)} ${isActive ? 'active' : ''} ${request.approved === true ? 'approved' : ''} ${request.approved === false ? 'rejected' : ''}" data-id="${request.id}">
      <div class="rc-header">
        <h3 class="rc-title">${escapeHtml(request.objectName)}</h3>
        ${delHtml}
      </div>
      ${specInfoHtml}
      ${descHtml}
      ${contactHtml}
      ${defectReasonHtml}
      <div class="rc-meta">
        <span class="rc-type-badge type-${escapeHtml(request.controlType)}">
          <i class="fa-solid ${typeIconClass(request.controlType)}"></i> ${escapeHtml(request.controlType)}
        </span>
        <span class="rc-status ${statusClass}">${escapeHtml(request.status)}</span>
        ${verdictHtml}
      </div>
      <div class="rc-date"><i class="fa-regular fa-clock"></i>${formatDate(request.createdAt)} · ${escapeHtml(request.author)}</div>
      ${actionsHtml}
    </div>
  `;
}

/**
 * Рендерит список заявок с учётом фильтров.
 */
function renderList(requests, filters, activeId) {
  const search = (filters.search || '').trim().toLowerCase();
  const isGuest = filters.isGuest !== undefined ? filters.isGuest : false;

  const filtered = requests.filter((r) => {
    // Гости не должны видеть заявки, признанные годными
    if (isGuest && r.approved === true) {
      return false;
    }

    const matchesSearch = !search || 
      (r.objectName && r.objectName.toLowerCase().includes(search)) || 
      (r.description && r.description.toLowerCase().includes(search)) ||
      (r.contactPerson && r.contactPerson.toLowerCase().includes(search)) ||
      (r.jointNumber && r.jointNumber.toLowerCase().includes(search)) ||
      (r.welderId && r.welderId.toLowerCase().includes(search));
    const matchesType = filters.types.has(r.controlType);
    return matchesSearch && matchesType;
  });

  // Сортировка: годные вниз
  filtered.sort((a, b) => {
    if (a.approved === b.approved) return b.id - a.id;
    return a.approved ? 1 : -1;
  });

  if (filtered.length === 0) {
    el.requestsList.innerHTML = '';
    el.requestsList.appendChild(el.emptyState.cloneNode(true));
    if (requests.length > 0) {
      const empty = el.requestsList.querySelector('.empty-state p');
      if (empty) empty.innerHTML = 'Нет заявок, соответствующих фильтру.';
      const icon = el.requestsList.querySelector('.empty-state i');
      if (icon) icon.className = 'fa-solid fa-filter-circle-xmark';
    }
  } else {
    el.requestsList.innerHTML = filtered.map((r) => buildCardHtml(r, r.id === activeId, isGuest)).join('');
  }

  updateCounters(requests, isGuest);
  return filtered;
}

/** Обновляет счетчики заявок в боксе фильтров (только активные/в работе/брак) */
function updateCounters(requests, isGuest) {
  const activeRequests = requests.filter(r => r.approved !== true);
  if (el.statTotal) el.statTotal.textContent = activeRequests.length;
  if (el.cntVik) el.cntVik.textContent = activeRequests.filter((r) => r.controlType === 'Вик').length;
  if (el.cntUzk) el.cntUzk.textContent = activeRequests.filter((r) => r.controlType === 'Узк').length;
  if (el.cntRk) el.cntRk.textContent = activeRequests.filter((r) => r.controlType === 'Рк').length;
  if (el.cntCd) el.cntCd.textContent = activeRequests.filter((r) => r.controlType === 'Цд').length;
}

/** Собирает текущие значения формы в объект */
function getFormData() {
  return {
    objectName: el.fObjectName.value.trim(),
    controlType: el.fControlType.value,
    jointNumber: el.fJointNumber ? el.fJointNumber.value.trim() : '',
    diameter: el.fDiameter ? el.fDiameter.value.trim() : '',
    thickness: el.fThickness ? el.fThickness.value.trim() : '',
    steelGrade: el.fSteelGrade ? el.fSteelGrade.value.trim() : '',
    welderId: el.fWelderId ? el.fWelderId.value.trim() : '',
    description: el.fDescription ? el.fDescription.value.trim() : '',
    contactPerson: el.fContactPerson ? el.fContactPerson.value.trim() : '',
    status: el.fStatus ? el.fStatus.value : 'Новая',
  };
}

/** Проверяет валидность формы */
function validateForm(data) {
  if (!data.objectName) {
    return { valid: false, message: 'Укажите «Установка, Проект/Акт»' };
  }
  if (!data.controlType) {
    return { valid: false, message: 'Выберите тип контроля' };
  }
  return { valid: true };
}

/** Заполняет форму данными заявки (при редактировании) */
function fillForm(request) {
  el.fObjectName.value = request.objectName || '';
  el.fControlType.value = request.controlType || 'Вик';
  if (el.fJointNumber) el.fJointNumber.value = request.jointNumber || request.jointId || '';
  if (el.fDiameter) el.fDiameter.value = request.diameter || '';
  if (el.fThickness) el.fThickness.value = request.thickness || '';
  if (el.fSteelGrade) el.fSteelGrade.value = request.steelGrade || '';
  if (el.fWelderId) el.fWelderId.value = request.welderId || request.welderMark || '';
  if (el.fDescription) el.fDescription.value = request.description || '';
  if (el.fContactPerson) el.fContactPerson.value = request.contactPerson || '';
  if (el.fStatus) el.fStatus.value = request.status || 'Новая';
  if (el.fCreatedAt) el.fCreatedAt.value = formatDate(request.createdAt);
  if (el.fAuthor) el.fAuthor.value = request.author || '—';

  el.formTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Редактирование';
  el.btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> <span>Сохранить</span>';
  el.btnCancelEdit.style.display = 'inline-flex';
}

/** Сбрасывает форму в начальное состояние */
function resetForm(currentUser) {
  el.form.reset();
  el.fControlType.value = 'Вик';

  if (el.fJointNumber) el.fJointNumber.value = '';
  if (el.fDiameter) el.fDiameter.value = '';
  if (el.fThickness) el.fThickness.value = '';
  if (el.fSteelGrade) el.fSteelGrade.value = '';
  if (el.fWelderId) el.fWelderId.value = '';
  if (el.fStatus) el.fStatus.value = 'Новая';
  if (el.fCreatedAt) el.fCreatedAt.value = '—';
  if (el.fAuthor) el.fAuthor.value = currentUser || '—';

  el.formTitle.innerHTML = '<i class="fa-solid fa-file-pen"></i> Новая заявка';
  el.btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> <span>Создать</span>';
  el.btnCancelEdit.style.display = 'none';
}

/** Получает текущие фильтры из UI */
function getFilters() {
  const types = new Set();
  if (el.filterBox) {
    el.filterBox.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => types.add(cb.value));
  }
  const role = sessionStorage.getItem('weld_user_role');
  const username = (localStorage.getItem('weld_username') || '').toLowerCase().trim();
  const isGuest = role === 'guest' || (role !== 'admin' && role !== 'user' && username !== 'admin');
  return {
    search: el.searchInput ? el.searchInput.value : '',
    types: types,
    isGuest: isGuest
  };
}

/** Подсвечивает активную карточку */
function highlightCard(id) {
  document.querySelectorAll('.request-card').forEach((card) => {
    card.classList.toggle('active', Number(card.dataset.id) === id);
  });
}

/** Показывает модальное окно ввода имени пользователя */
function showUserModal(existingName) {
  el.inputUsername.value = existingName || '';
  el.modalUser.classList.add('show');
  setTimeout(() => el.inputUsername.focus(), 100);
}

function hideUserModal() {
  el.modalUser.classList.remove('show');
}

function setUserBadge(name) {
  if (el.userNameSpan) el.userNameSpan.textContent = name;
}

/** Модалка подтверждения удаления */
let pendingDeleteId = null;
function showConfirmDelete(request, onConfirm) {
  el.confirmText.innerHTML = `Вы действительно хотите удалить заявку <b>${escapeHtml(request.objectName)}</b>?`;
  el.modalConfirm.classList.add('show');
  
  const handleConfirm = () => {
    onConfirm(request.id);
    closeModal();
  };
  const closeModal = () => {
    el.modalConfirm.classList.remove('show');
    el.btnConfirmDelete.removeEventListener('click', handleConfirm);
    el.btnCancelDelete.removeEventListener('click', closeModal);
  };
  
  el.btnConfirmDelete.addEventListener('click', handleConfirm);
  el.btnCancelDelete.addEventListener('click', closeModal);
}

function showApproveModal(request, defaultInspector, onConfirm) {
  const name = request.objectName || 'Заявка';
  const joint = request.jointNumber ? ` (стык №${request.jointNumber})` : '';
  if (el.approveText) {
    el.approveText.innerHTML = `Признать годным: <b>${escapeHtml(name)}</b>${escapeHtml(joint)}?<br><span style="color:var(--text-dim);font-size:11px;">После подтверждения статус заявки будет «Завершена», а для гостей она перестанет отображаться.</span>`;
  }
  if (el.inputApproveInspector) {
    el.inputApproveInspector.value = defaultInspector || '';
  }
  el.modalApprove.classList.add('show');
  if (el.inputApproveInspector) {
    el.inputApproveInspector.focus();
  }

  const handleConfirm = () => {
    const inspector = el.inputApproveInspector ? el.inputApproveInspector.value.trim() : '';
    onConfirm(inspector || defaultInspector || 'Контролёр');
    closeModal();
  };
  const closeModal = () => {
    el.modalApprove.classList.remove('show');
    el.btnConfirmApprove.removeEventListener('click', handleConfirm);
    el.btnCancelApprove.removeEventListener('click', closeModal);
  };

  el.btnConfirmApprove.addEventListener('click', handleConfirm);
  el.btnCancelApprove.addEventListener('click', closeModal);
}

function showRejectModal(onConfirm) {
  el.inputDefectReason.value = '';
  el.modalReject.classList.add('show');
  el.inputDefectReason.focus();

  const handleConfirm = () => {
    const reason = el.inputDefectReason.value.trim();
    if (!reason) {
      showToast('Укажите причину брака', 'error');
      return;
    }
    onConfirm(reason);
    closeModal();
  };
  const closeModal = () => {
    el.modalReject.classList.remove('show');
    el.btnConfirmReject.removeEventListener('click', handleConfirm);
    el.btnCancelReject.removeEventListener('click', closeModal);
  };

  el.btnConfirmReject.addEventListener('click', handleConfirm);
  el.btnCancelReject.addEventListener('click', closeModal);
}

function hideConfirmDelete() {
  if (el.modalConfirm) el.modalConfirm.classList.remove('show');
  pendingDeleteId = null;
  deleteCallback = null;
}

function bindConfirmDeleteButtons() {
  if (el.btnConfirmDelete) {
    el.btnConfirmDelete.addEventListener('click', () => {
      if (deleteCallback && pendingDeleteId !== null) {
        deleteCallback(pendingDeleteId);
      }
      hideConfirmDelete();
    });
  }
  if (el.btnCancelDelete) {
    el.btnCancelDelete.addEventListener('click', hideConfirmDelete);
  }
}

/** Показывает тост-уведомление */
function showToast(message, type = 'info') {
  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info',
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
  if (el.toastContainer) {
    el.toastContainer.appendChild(toast);
  }
  setTimeout(() => toast.remove(), 3000);
}

function hideMapHint() {
  if (el.mapHint) el.mapHint.style.opacity = '0';
}

function showMapHint(text) {
  if (!el.mapHint) return;
  if (text) el.mapHint.querySelector('span').textContent = text;
  el.mapHint.style.opacity = '1';
}

// ===== ЭКСПОРТ =====
export const UI = {
  TYPE_COLORS,
  cacheElements,
  renderList,
  updateCounters,
  getFormData,
  validateForm,
  fillForm,
  resetForm,
  getFilters,
  highlightCard,
  showUserModal,
  hideUserModal,
  setUserBadge,
  showConfirmDelete,
  showApproveModal,
  showRejectModal,
  hideConfirmDelete,
  bindConfirmDeleteButtons,
  showToast,
  hideMapHint,
  showMapHint,
  formatDate,
  get els() { return el; },
};