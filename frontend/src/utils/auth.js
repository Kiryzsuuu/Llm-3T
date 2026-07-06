const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem('role', user.role);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function updateUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem('role', user.role);
}

export function getRole() {
  return localStorage.getItem('role');
}

export function isLoggedIn() {
  return Boolean(getToken());
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('role');
}
