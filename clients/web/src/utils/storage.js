// src/utils/storage.js
/**
 * Utilidades para gestionar almacenamiento local y de sesión
 */

/**
 * Guarda un valor en localStorage
 * @param {string} key - Clave para el almacenamiento
 * @param {any} value - Valor a almacenar
 * @returns {boolean} - true si se guardó correctamente
 */
export const setLocalItem = (key, value) => {
  if (!key) return false;

  try {
    // Convertir objetos y arrays a JSON
    const valueToStore =
      typeof value === "object" ? JSON.stringify(value) : String(value);

    localStorage.setItem(key, valueToStore);
    return true;
  } catch (error) {
    console.error("Error al guardar en localStorage:", error);
    return false;
  }
};

/**
 * Obtiene un valor de localStorage
 * @param {string} key - Clave a recuperar
 * @param {any} [defaultValue=null] - Valor por defecto si no existe
 * @returns {any} - Valor almacenado o defaultValue
 */
export const getLocalItem = (key, defaultValue = null) => {
  if (!key) return defaultValue;

  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;

    // Intentar parsear JSON si es posible
    try {
      return JSON.parse(value);
    } catch (e) {
      // Si no es JSON, devolver el valor como está
      return value;
    }
  } catch (error) {
    console.error("Error al recuperar de localStorage:", error);
    return defaultValue;
  }
};

/**
 * Elimina un valor de localStorage
 * @param {string} key - Clave a eliminar
 * @returns {boolean} - true si se eliminó correctamente
 */
export const removeLocalItem = (key) => {
  if (!key) return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("Error al eliminar de localStorage:", error);
    return false;
  }
};

/**
 * Limpia todo el localStorage
 * @returns {boolean} - true si se limpió correctamente
 */
export const clearLocalStorage = () => {
  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.error("Error al limpiar localStorage:", error);
    return false;
  }
};

/**
 * Guarda un valor en sessionStorage
 * @param {string} key - Clave para el almacenamiento
 * @param {any} value - Valor a almacenar
 * @returns {boolean} - true si se guardó correctamente
 */
export const setSessionItem = (key, value) => {
  if (!key) return false;

  try {
    // Convertir objetos y arrays a JSON
    const valueToStore =
      typeof value === "object" ? JSON.stringify(value) : String(value);

    sessionStorage.setItem(key, valueToStore);
    return true;
  } catch (error) {
    console.error("Error al guardar en sessionStorage:", error);
    return false;
  }
};

/**
 * Obtiene un valor de sessionStorage
 * @param {string} key - Clave a recuperar
 * @param {any} [defaultValue=null] - Valor por defecto si no existe
 * @returns {any} - Valor almacenado o defaultValue
 */
export const getSessionItem = (key, defaultValue = null) => {
  if (!key) return defaultValue;

  try {
    const value = sessionStorage.getItem(key);
    if (value === null) return defaultValue;

    // Intentar parsear JSON si es posible
    try {
      return JSON.parse(value);
    } catch (e) {
      // Si no es JSON, devolver el valor como está
      return value;
    }
  } catch (error) {
    console.error("Error al recuperar de sessionStorage:", error);
    return defaultValue;
  }
};

/**
 * Elimina un valor de sessionStorage
 * @param {string} key - Clave a eliminar
 * @returns {boolean} - true si se eliminó correctamente
 */
export const removeSessionItem = (key) => {
  if (!key) return false;

  try {
    sessionStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("Error al eliminar de sessionStorage:", error);
    return false;
  }
};

/**
 * Limpia todo el sessionStorage
 * @returns {boolean} - true si se limpió correctamente
 */
export const clearSessionStorage = () => {
  try {
    sessionStorage.clear();
    return true;
  } catch (error) {
    console.error("Error al limpiar sessionStorage:", error);
    return false;
  }
};

/**
 * Guarda una clave-valor con tiempo de expiración en localStorage
 * @param {string} key - Clave para el almacenamiento
 * @param {any} value - Valor a almacenar
 * @param {number} expirationInMinutes - Tiempo de expiración en minutos
 * @returns {boolean} - true si se guardó correctamente
 */
export const setLocalItemWithExpiry = (key, value, expirationInMinutes) => {
  if (!key) return false;

  try {
    const now = new Date();
    const expiryTime = now.getTime() + expirationInMinutes * 60 * 1000;

    const item = {
      value,
      expiry: expiryTime,
    };

    return setLocalItem(key, item);
  } catch (error) {
    console.error("Error al guardar con expiración:", error);
    return false;
  }
};

/**
 * Obtiene un valor de localStorage con verificación de expiración
 * @param {string} key - Clave a recuperar
 * @param {any} [defaultValue=null] - Valor por defecto si no existe o expiró
 * @returns {any} - Valor almacenado o defaultValue
 */
export const getLocalItemWithExpiry = (key, defaultValue = null) => {
  if (!key) return defaultValue;

  try {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return defaultValue;

    const item = JSON.parse(itemStr);
    const now = new Date().getTime();

    // Comprobar si ha expirado
    if (item.expiry && now > item.expiry) {
      // Si ha expirado, eliminar del localStorage
      localStorage.removeItem(key);
      return defaultValue;
    }

    return item.value;
  } catch (error) {
    console.error("Error al recuperar con expiración:", error);
    return defaultValue;
  }
};

/**
 * Comprueba si un elemento existe en localStorage
 * @param {string} key - Clave a comprobar
 * @returns {boolean} - true si existe
 */
export const hasLocalItem = (key) => {
  if (!key) return false;

  try {
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error("Error al comprobar localStorage:", error);
    return false;
  }
};

/**
 * Comprueba si el navegador soporta localStorage
 * @returns {boolean} - true si está soportado
 */
export const isLocalStorageSupported = () => {
  try {
    const testKey = "__test__";
    localStorage.setItem(testKey, testKey);
    const result = localStorage.getItem(testKey) === testKey;
    localStorage.removeItem(testKey);
    return result;
  } catch (e) {
    return false;
  }
};
