/**
 * data.js — работа с данными (Firebase + localStorage)
 */

import { 
  requestsCollection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from './firebase.js';

const STORAGE_KEY = 'weld_requests';
const USER_KEY = 'weld_username';
const USERS_KEY = 'weld_users';

// ===== LOCALSTORAGE (кеш) =====
function getAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(requests) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    return true;
  } catch {
    return false;
  }
}

function getById(id) {
  const requests = getAll();
  return requests.find((r) => r.id === id) || null;
}

// ===== FIREBASE (облако) =====

/** Загружает все заявки из Firebase */
async function loadFromFirebase() {
  try {
    const q = query(requestsCollection, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const rawRequests = [];
    snapshot.forEach((doc) => {
      rawRequests.push({ id: doc.id, ...doc.data() });
    });

    // Упорядочиваем по времени создания для вычисления сквозного номера
    const sorted = [...rawRequests].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    sorted.forEach((req, idx) => {
      req.requestNumber = req.requestNumber || (idx + 1);
    });

    saveAll(rawRequests);
    return rawRequests;
  } catch (err) {
    console.error('[Firebase] Ошибка загрузки:', err);
    return [];
  }
}

/** Создаёт заявку в Firebase (со сквозным номером) */
async function createInFirebase(data) {
  try {
    const existing = getAll();
    // Определяем следующий порядковый сквозной номер
    let maxNumber = 0;
    existing.forEach((r) => {
      if (r.requestNumber && typeof r.requestNumber === 'number' && r.requestNumber > maxNumber) {
        maxNumber = r.requestNumber;
      }
    });
    if (maxNumber === 0 && existing.length > 0) {
      maxNumber = existing.length;
    }
    const nextNumber = maxNumber + 1;

    const docPayload = {
      ...data,
      requestNumber: nextNumber,
      createdAt: data.createdAt || new Date().toISOString(),
      approved: data.approved !== undefined ? data.approved : null
    };

    const docRef = await addDoc(requestsCollection, docPayload);
    const newRequest = { id: docRef.id, ...docPayload };
    const requests = getAll();
    requests.push(newRequest);
    saveAll(requests);
    return newRequest;
  } catch (err) {
    console.error('[Firebase] Ошибка создания:', err);
    throw err;
  }
}

/** Обновляет заявку в Firebase */
async function updateInFirebase(id, patch) {
  try {
    const docRef = doc(requestsCollection, id);
    await updateDoc(docRef, patch);
    const requests = getAll();
    const idx = requests.findIndex((r) => r.id === id);
    if (idx !== -1) {
      requests[idx] = { ...requests[idx], ...patch };
      saveAll(requests);
    }
    return { id, ...patch };
  } catch (err) {
    console.error('[Firebase] Ошибка обновления:', err);
    throw err;
  }
}

/** Удаляет заявку из Firebase */
async function removeFromFirebase(id) {
  try {
    const docRef = doc(requestsCollection, id);
    await deleteDoc(docRef);
    const requests = getAll().filter((r) => r.id !== id);
    saveAll(requests);
    return true;
  } catch (err) {
    console.error('[Firebase] Ошибка удаления:', err);
    return false;
  }
}

/** Подписка на обновления в реальном времени */
function subscribeToFirebase(callback) {
  const q = query(requestsCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const rawRequests = [];
    snapshot.forEach((doc) => {
      rawRequests.push({ id: doc.id, ...doc.data() });
    });

    const sorted = [...rawRequests].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    sorted.forEach((req, idx) => {
      req.requestNumber = req.requestNumber || (idx + 1);
    });

    saveAll(rawRequests);
    if (callback) callback(rawRequests);
  }, (error) => {
    console.error('[Firebase] Ошибка подписки:', error);
  });
}

// ===== УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ =====
function getUsers() {
  const defaultUsers = { 
    admin: { password: 'admin123', role: 'admin' },
    user: { password: 'user123', role: 'user' },
    guest: { password: '', role: 'guest' },
    гость: { password: '', role: 'guest' }
  };
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      saveUsers(defaultUsers);
      return defaultUsers;
    }
    return { ...defaultUsers, ...JSON.parse(raw) };
  } catch { 
    return defaultUsers;
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function authenticate(login, password) {
  const users = getUsers();
  const lower = (login || '').toLowerCase().trim();

  // Быстрый гостевой доступ
  if (lower === 'гость' || lower === 'guest' || (!password && login)) {
    return { role: 'guest', name: login || 'Гость' };
  }

  if (users[login] && users[login].password === password) {
    return users[login];
  }
  if (users[lower] && users[lower].password === password) {
    return users[lower];
  }
  return null;
}

function registerUser(login, password, role = 'user') {
  const users = getUsers();
  if (users[login]) return false;
  users[login] = { password, role };
  saveUsers(users);
  return true;
}

function getUsername() {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

function setUsername(name) {
  try {
    localStorage.setItem(USER_KEY, name);
    return true;
  } catch {
    return false;
  }
}

// ===== ЭКСПОРТ =====
export {
  // localStorage
  getAll,
  saveAll,
  getById,
  // Firebase
  loadFromFirebase,
  createInFirebase,
  updateInFirebase,
  removeFromFirebase,
  subscribeToFirebase,
  // Пользователи
  getUsers,
  saveUsers,
  authenticate,
  registerUser,
  getUsername,
  setUsername
};