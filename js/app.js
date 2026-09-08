/**
 * app.js — основная логика приложения "Сварочный контроль"
 */

// ===== ИМПОРТЫ =====
import { 
  loadFromFirebase,
  createInFirebase,
  updateInFirebase,
  removeFromFirebase,
  subscribeToFirebase,
  getAll,
  getById,
  getUsername,
  setUsername,
  authenticate,
  registerUser
} from './data.js';

import { UI } from './ui.js';

const App = (() => {
  let currentUser = null;
  let activeRequestId = null;
  let isCreatingNew = false;

  /** Точка входа приложения */
  async function init() {
    UI.cacheElements();
    bindUIEvents();
    UI.bindConfirmDeleteButtons();

    // Загрузка данных из Firebase
    try {
      await loadFromFirebase();
      UI.showToast('Данные загружены из облака', 'success');
    } catch (err) {
      UI.showToast('Используем локальные данные', 'info');
    }

    // Подписка на обновления в реальном времени
    subscribeToFirebase((requests) => {
      refreshAll();
      UI.showToast('Данные обновлены', 'info');
    });

    // Проверка входа
    checkLogin();

    console.log('[App] Приложение запущено с Firebase');
  }

  /** Проверяет, авторизован ли пользователь */
  function checkLogin() {
    const saved = sessionStorage.getItem('weld_logged_in');
    if (saved === 'true') {
      const username = getUsername() || 'Гость';
      currentUser = username;
      UI.setUserBadge(username);
      document.getElementById('modal-login').classList.remove('show');
      document.getElementById('app').style.display = 'flex';
      refreshAll();
      return;
    }
    document.getElementById('modal-login').classList.add('show');
    document.getElementById('app').style.display = 'none';
  }

  /** Привязывает обработчики к элементам интерфейса */
  function bindUIEvents() {
    const el = UI.els;

    // --- Вход ---
    document.getElementById('btn-login').addEventListener('click', handleLogin);
    const btnGuest = document.getElementById('btn-guest');
    if (btnGuest) {
      btnGuest.addEventListener('click', handleGuestLogin);
    }
    document.getElementById('login-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('login-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const password = document.getElementById('login-password').value.trim();
        if (password) {
          handleLogin();
        } else {
          handleGuestLogin();
        }
      }
    });

    // --- Модалка имени пользователя ---
    el.btnSaveUsername.addEventListener('click', saveUsername);
    el.inputUsername.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveUsername();
    });
    el.btnChangeUser.addEventListener('click', () => UI.showUserModal(currentUser));

    // --- Поиск (выдвижная панель) ---
    document.getElementById('btn-search-toggle').addEventListener('click', () => {
      const bar = document.getElementById('search-bar');
      bar.classList.toggle('active');
      if (bar.classList.contains('active')) {
        document.getElementById('search-input').focus();
      }
    });
    document.getElementById('search-close').addEventListener('click', () => {
      document.getElementById('search-bar').classList.remove('active');
      document.getElementById('search-input').value = '';
      refreshList();
    });

    // --- Поиск и фильтры ---
    el.searchInput.addEventListener('input', refreshList);
    el.filterBox.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', refreshList);
    });

    // --- Форма заявки ---
    el.form.addEventListener('submit', handleFormSubmit);
    el.btnCancelEdit.addEventListener('click', handleCancelEdit);

    // --- Список заявок ---
    el.requestsList.addEventListener('click', handleListClick);

    // --- Экспорт JSON ---
    document.getElementById('btn-export').addEventListener('click', handleExport);

    // --- Кнопка свёртки списка ---
    document.getElementById('panel-toggle').addEventListener('click', () => {
      const panel = document.getElementById('panel-list');
      panel.classList.toggle('collapsed');
      const icon = document.querySelector('#panel-toggle i');
      if (panel.classList.contains('collapsed')) {
        icon.className = 'fa-solid fa-chevron-down';
      } else {
        icon.className = 'fa-solid fa-chevron-up';
      }
    });

    // --- Кнопка свёртки формы ---
    document.getElementById('panel-form-toggle').addEventListener('click', () => {
      const panel = document.getElementById('panel-form');
      panel.classList.toggle('collapsed');
      const icon = document.querySelector('#panel-form-toggle i');
      if (panel.classList.contains('collapsed')) {
        icon.className = 'fa-solid fa-chevron-down';
      } else {
        icon.className = 'fa-solid fa-chevron-up';
      }
    });
  }

  /** Обработчик гостевого входа */
  function handleGuestLogin() {
    const inputName = document.getElementById('login-username').value.trim();
    const existingName = getUsername();
    const guestName = inputName || existingName || 'Гость';

    sessionStorage.setItem('weld_logged_in', 'true');
    sessionStorage.setItem('weld_user_role', 'guest');
    setUsername(guestName);
    currentUser = guestName;
    UI.setUserBadge(guestName);
    document.getElementById('modal-login').classList.remove('show');
    document.getElementById('app').style.display = 'flex';
    UI.showToast(`Вы вошли как ${guestName}`, 'info');
    refreshAll();
  }

  /** Обработчик входа */
  function handleLogin() {
    const login = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    // Если логин пустой или пароль не указан — выполняем гостевой вход
    if (!login || !password) {
      handleGuestLogin();
      return;
    }

    const user = authenticate(login, password);
    if (user) {
      sessionStorage.setItem('weld_logged_in', 'true');
      sessionStorage.setItem('weld_user_role', user.role || 'user');
      setUsername(login);
      currentUser = login;
      UI.setUserBadge(login);
      document.getElementById('modal-login').classList.remove('show');
      document.getElementById('app').style.display = 'flex';
      UI.showToast(`Добро пожаловать, ${login}!`, 'success');
      refreshAll();
    } else {
      UI.showToast('Неверный пароль. Для входа без пароля нажмите «Войти как гость»', 'error');
    }
  }

  /** Сохраняет имя пользователя из модалки */
  function saveUsername() {
    const name = UI.els.inputUsername.value.trim();
    if (!name) {
      UI.showToast('Введите имя, чтобы продолжить', 'error');
      return;
    }
    currentUser = name;
    setUsername(name);
    UI.setUserBadge(name);
    UI.hideUserModal();
    UI.showToast(`Добро пожаловать, ${name}!`, 'success');
    UI.els.fAuthor.value = currentUser;
  }

  /** Проверяет, является ли текущий пользователь гостем */
  function isGuestUser() {
    const role = sessionStorage.getItem('weld_user_role');
    if (role === 'admin' || role === 'user') return false;
    if (role === 'guest') return true;
    const name = (currentUser || getUsername() || '').toLowerCase().trim();
    return name !== 'admin';
  }

  /** Перерисовывает список заявок */
  function refreshList() {
    const requests = getAll();
    const filters = UI.getFilters();
    filters.isGuest = isGuestUser();

    // Если выбранная заявка стала годной, для гостя сбрасываем форму
    if (filters.isGuest && activeRequestId) {
      const activeReq = getById(activeRequestId);
      if (activeReq && activeReq.approved === true) {
        activeRequestId = null;
        isCreatingNew = false;
        UI.resetForm(currentUser);
      }
    }

    const filtered = UI.renderList(requests, filters, activeRequestId);
  }

  /** Полное обновление */
  function refreshAll() {
    const requests = getAll();
    refreshList();
  }

  // ==========================================================================
  // Обработчики формы
  // ==========================================================================

  async function handleFormSubmit(e) {
    e.preventDefault();
    const data = UI.getFormData();
    const validation = UI.validateForm(data);

    if (!validation.valid) {
      UI.showToast(validation.message, 'error');
      return;
    }

    try {
      if (activeRequestId !== null && !isCreatingNew) {
        // Режим обновления
        const existing = getById(activeRequestId);
        const patch = { ...data };
        if (existing && existing.status) {
          patch.status = existing.status;
        }
        await updateInFirebase(activeRequestId, patch);
        UI.showToast('Заявка обновлена', 'success');
        refreshList();
      } else {
        // Режим создания
        const newRequest = await createInFirebase({
          ...data,
          createdAt: new Date().toISOString(),
          author: currentUser || 'Гость',
          approved: null,
          status: 'Новая'
        });
        UI.showToast(`Заявка «${newRequest.objectName}» создана`, 'success');

        activeRequestId = newRequest.id;
        isCreatingNew = false;
        UI.fillForm(newRequest);
        refreshList();
      }
    } catch (err) {
      console.error('[App] Ошибка сохранения заявки:', err);
      UI.showToast('Произошла ошибка при сохранении заявки', 'error');
    }
  }

  function handleCancelEdit() {
    activeRequestId = null;
    isCreatingNew = false;
    UI.resetForm(currentUser);
    UI.highlightCard(null);
  }

  function handleEditRequest(id) {
    const request = getById(id);
    if (!request) {
      UI.showToast('Заявка не найдена', 'error');
      return;
    }
    activeRequestId = id;
    isCreatingNew = false;
    UI.fillForm(request);
    UI.highlightCard(id);
  }

  // ==========================================================================
  // Обработчики списка заявок
  // ==========================================================================

  function handleListClick(e) {
    const delBtn = e.target.closest('.rc-del');
    if (delBtn) {
      e.stopPropagation();
      const id = String(delBtn.dataset.id);
      const request = getById(id);
      if (request) {
        UI.showConfirmDelete(request, handleDeleteRequest);
      }
      return;
    }

    // Кнопки "Годен" / "Не годен"
    const voteBtn = e.target.closest('.btn-vote');
    if (voteBtn) {
      e.stopPropagation();
      if (isGuestUser()) {
        UI.showToast('Гости не могут изменять статус годности заявок', 'error');
        return;
      }
      const id = String(voteBtn.dataset.id);
      const value = voteBtn.classList.contains('btn-approve');
      handleVoteClick(id, value);
      return;
    }

    const card = e.target.closest('.request-card');
    if (card) {
      const id = String(card.dataset.id);
      handleEditRequest(id);
    }
  }

  /** Обработчик голосования */
  function handleVoteClick(id, value) {
    if (isGuestUser()) {
      UI.showToast('Гости не могут изменять статус годности заявок', 'error');
      return;
    }

    const request = getById(id);
    if (!request) return;

    const inspector = currentUser || getUsername() || 'Контролёр';

    if (value === false) {
      // Открываем модалку для ввода причины брака
      UI.showRejectModal(async (reason) => {
        try {
          await updateInFirebase(id, {
            approved: false,
            status: 'Завершена',
            defectReason: reason,
            rejectedBy: inspector
          });
          refreshList();
          UI.showToast('❌ Заявка признана НЕ ГОДНОЙ', 'error');
        } catch (err) {
          UI.showToast('Ошибка при голосовании', 'error');
        }
      });
    } else {
      // Открываем модалку подтверждения годности с указанием контролёра
      UI.showApproveModal(request, inspector, async (confirmedInspector) => {
        try {
          await updateInFirebase(id, {
            approved: true,
            status: 'Завершена',
            defectReason: null,
            approvedBy: confirmedInspector || inspector
          });
          refreshList();
          UI.showToast(`✅ Заявка признана ГОДНОЙ (${confirmedInspector || inspector})`, 'success');
        } catch (err) {
          UI.showToast('Ошибка при голосовании', 'error');
        }
      });
    }
  }

  /** Выполняет удаление заявки */
  async function handleDeleteRequest(id) {
    try {
      await removeFromFirebase(id);
      if (activeRequestId === id) {
        activeRequestId = null;
        isCreatingNew = false;
        UI.resetForm(currentUser);
      }
      refreshList();
      UI.showToast('Заявка удалена', 'success');
    } catch (err) {
      UI.showToast('Не удалось удалить заявку', 'error');
    }
  }

  // ==========================================================================
  // Экспорт данных
  // ==========================================================================

  function handleExport() {
    try {
      let requests = getAll();
      if (isGuestUser()) {
        requests = requests.filter(r => r.approved !== true);
      }
      if (requests.length === 0) {
        UI.showToast('Нет заявок для экспорта', 'error');
        return;
      }
      
      // Формируем CSV
      const headers = ['ID', 'Объект', '№ стыка', 'Диаметр', 'Толщина', 'Марка стали', 'Клеймо', 'Тип контроля', 'Статус', 'Годен', 'Дефект', 'Контролер', 'Автор', 'Дата'];
      const rows = requests.map(r => [
        r.id,
        `"${(r.objectName || '').replace(/"/g, '""')}"`,
        `"${(r.jointNumber || '').replace(/"/g, '""')}"`,
        r.diameter || '',
        r.thickness || '',
        r.steelGrade || '',
        r.welderId || '',
        r.controlType || '',
        r.status || '',
        r.approved === true ? 'Да' : (r.approved === false ? 'Нет' : ''),
        `"${(r.defectReason || '').replace(/"/g, '""')}"`,
        `"${(r.approvedBy || r.rejectedBy || '').replace(/"/g, '""')}"`,
        `"${(r.author || '').replace(/"/g, '""')}"`,
        r.createdAt || ''
      ]);
      
      const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `weld_requests_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      UI.showToast('Реестр экспортирован в CSV', 'success');
    } catch (err) {
      console.error('[App] Ошибка экспорта:', err);
      UI.showToast('Ошибка при экспорте данных', 'error');
    }
  }

  return { init };
})();

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
  try {
    App.init();
  } catch (err) {
    console.error('[App] Критическая ошибка:', err);
    alert('Не удалось запустить приложение. Подробности в консоли (F12).');
  }
});