// clients/web/src/utils/auth.js
import apiConfig from "../config/api";
import axios from "axios";

const API_URL = apiConfig.API_URL;

/**
 * Obtener el token de autenticación almacenado en localStorage
 * @returns {string|null} El token JWT o null si no hay sesión
 */
export const getAuthToken = () => {
  return localStorage.getItem("streamvio_token");
};

/**
 * Verificar si el usuario está autenticado
 * @returns {boolean} true si hay un token de autenticación, false en caso contrario
 */
export const isAuthenticated = () => {
  return !!getAuthToken();
};

/**
 * Añadir parámetro de autenticación a una URL
 * @param {string} url - URL base a la que añadir el token
 * @returns {string} URL con el token añadido como parámetro de consulta
 */
export const addAuthToUrl = (url) => {
  const token = getAuthToken();
  if (!token) return url;

  // Verificar si la URL ya tiene parámetros
  const hasParams = url.includes("?");
  const separator = hasParams ? "&" : "?";

  return `${url}${separator}auth=${token}`;
};

/**
 * Obtener la URL para reproducir un medio con autenticación
 * @param {number|string} mediaId - ID del medio a reproducir
 * @param {string} streamType - Tipo de stream ('direct' o 'hls')
 * @param {boolean} hlsAvailable - Si está disponible el streaming HLS
 * @param {object} mediaData - Datos del medio (para HLS)
 * @returns {string} URL de streaming con autenticación
 */
export const getStreamUrl = (
  mediaId,
  streamType = "direct",
  hlsAvailable = false,
  mediaData = null
) => {
  if (
    streamType === "hls" &&
    hlsAvailable &&
    mediaData &&
    mediaData.file_path
  ) {
    // URL para streaming HLS
    const fileName = mediaData.file_path
      .split(/[\/\\]/)
      .pop()
      .split(".")[0];

    return addAuthToUrl(
      `${API_URL}/data/transcoded/${fileName}_hls/master.m3u8`
    );
  } else {
    // URL para streaming directo
    return addAuthToUrl(`${API_URL}/api/media/${mediaId}/stream`);
  }
};

/**
 * Verificar y reparar permisos de una carpeta
 * @param {string} folderPath - Ruta de la carpeta a verificar
 * @returns {Promise<object>} Resultado de la verificación
 */
export const checkFolderPermissions = async (folderPath) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error("No hay sesión activa");
    }

    const response = await axios.post(
      `${API_URL}/api/filesystem/check-permissions`,
      { path: folderPath },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
  } catch (error) {
    console.error("Error al verificar permisos:", error);
    throw error;
  }
};

/**
 * Reparar permisos de una carpeta
 * @param {string} folderPath - Ruta de la carpeta a reparar
 * @returns {Promise<object>} Resultado de la reparación
 */
export const fixFolderPermissions = async (folderPath) => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error("No hay sesión activa");
    }

    const response = await axios.post(
      `${API_URL}/api/filesystem/fix-permissions`,
      { path: folderPath },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
  } catch (error) {
    console.error("Error al reparar permisos:", error);
    throw error;
  }
};
