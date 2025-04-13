// src/context/MediaContext.jsx
import React, { createContext, useState, useCallback, useContext } from "react";
import mediaService from "../services/mediaService.js";
import { UIContext } from "./UIContext.jsx";

// Crear el contexto con un valor inicial vacío
export const MediaContext = createContext();

/**
 * Proveedor de contexto para gestión de elementos multimedia
 * Proporciona funcionalidades para interactuar con contenido multimedia
 */
export const MediaProvider = ({ children }) => {
  // Referencia al contexto de UI para notificaciones
  const { showError } = useContext(UIContext) || { showError: console.error };

  // Estados para almacenar contenido multimedia
  const [currentMedia, setCurrentMedia] = useState(null);
  const [watchHistory, setWatchHistory] = useState([]);
  const [inProgressItems, setInProgressItems] = useState([]);
  const [recentItems, setRecentItems] = useState([]);
  const [loading, setLoading] = useState(false);

  /**
   * Obtener un elemento multimedia por ID
   * @param {number} id - ID del elemento multimedia
   * @returns {Promise<Object>} - Detalles del elemento multimedia
   */
  const getMediaById = useCallback(
    async (id) => {
      setLoading(true);
      try {
        const media = await mediaService.getMediaById(id);
        setCurrentMedia(media);
        return media;
      } catch (error) {
        showError("No se pudo cargar el contenido multimedia");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  /**
   * Buscar elementos multimedia con filtros
   * @param {Object} searchParams - Parámetros de búsqueda
   * @returns {Promise<Object>} - Resultados de la búsqueda
   */
  const searchMedia = useCallback(
    async (searchParams = {}) => {
      setLoading(true);
      try {
        return await mediaService.searchMedia(searchParams);
      } catch (error) {
        showError("Error al buscar contenido multimedia");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  /**
   * Obtener URL de miniatura de un elemento multimedia
   * @param {number} id - ID del elemento multimedia
   * @returns {string} - URL de la miniatura
   */
  const getThumbnailUrl = useCallback((id) => {
    return mediaService.getThumbnailUrl(id);
  }, []);

  /**
   * Obtener URL de streaming para un elemento multimedia
   * @param {number} id - ID del elemento multimedia
   * @param {string} [format='direct'] - Formato de streaming ('direct', 'hls')
   * @returns {string} - URL de streaming
   */
  const getStreamUrl = useCallback((id, format = "direct") => {
    return mediaService.getStreamUrl(id, format);
  }, []);

  /**
   * Obtener opciones de streaming para un elemento multimedia
   * @param {number} id - ID del elemento multimedia
   * @returns {Promise<Object>} - Opciones de streaming
   */
  const getStreamingOptions = useCallback(
    async (id) => {
      try {
        return await mediaService.getStreamingOptions(id);
      } catch (error) {
        showError("Error al obtener opciones de streaming");
        throw error;
      }
    },
    [showError]
  );

  /**
   * Actualizar progreso de visualización
   * @param {number} mediaId - ID del elemento multimedia
   * @param {number} position - Posición actual en segundos
   * @param {boolean} [completed=false] - Si se ha completado la visualización
   * @returns {Promise<Object>} - Datos actualizados de progreso
   */
  const updateProgress = useCallback(
    async (mediaId, position, completed = false) => {
      try {
        const result = await mediaService.updateProgress(
          mediaId,
          position,
          completed
        );

        // Actualizar el elemento actual si estamos viendo ese mismo elemento
        if (currentMedia && currentMedia.id === mediaId) {
          setCurrentMedia((prev) => ({
            ...prev,
            watchProgress: result,
          }));
        }

        // Actualizar listas que pueden contener este elemento
        refreshInProgressItems();

        return result;
      } catch (error) {
        showError("Error al actualizar progreso de visualización");
        throw error;
      }
    },
    [currentMedia, showError]
  );

  /**
   * Marcar un elemento como visto completamente
   * @param {number} mediaId - ID del elemento multimedia
   * @returns {Promise<Object>} - Datos actualizados de progreso
   */
  const markAsWatched = useCallback(
    async (mediaId) => {
      try {
        const result = await mediaService.markAsWatched(mediaId);

        // Actualizar el elemento actual si estamos viendo ese mismo elemento
        if (currentMedia && currentMedia.id === mediaId) {
          setCurrentMedia((prev) => ({
            ...prev,
            watchProgress: {
              ...prev.watchProgress,
              completed: true,
              position: prev.duration || 0,
            },
          }));
        }

        // Actualizar listas que pueden contener este elemento
        refreshInProgressItems();

        return result;
      } catch (error) {
        showError("Error al marcar como visto");
        throw error;
      }
    },
    [currentMedia, showError]
  );

  /**
   * Cargar historial de visualización
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Historial de visualización
   */
  const loadWatchHistory = useCallback(
    async (options = {}) => {
      setLoading(true);
      try {
        const history = await mediaService.getWatchHistory(options);
        setWatchHistory(history);
        return history;
      } catch (error) {
        showError("Error al cargar historial de visualización");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  /**
   * Cargar elementos en progreso
   * @param {number} [limit=10] - Cantidad máxima de elementos
   * @returns {Promise<Array>} - Elementos en progreso
   */
  const refreshInProgressItems = useCallback(async (limit = 10) => {
    try {
      const items = await mediaService.getInProgress(limit);
      setInProgressItems(items);
      return items;
    } catch (error) {
      console.error("Error al cargar elementos en progreso:", error);
      return [];
    }
  }, []);

  /**
   * Cargar elementos vistos recientemente
   * @param {number} [limit=10] - Cantidad máxima de elementos
   * @returns {Promise<Array>} - Elementos recientes
   */
  const refreshRecentItems = useCallback(async (limit = 10) => {
    try {
      const items = await mediaService.getRecentlyWatched(limit);
      setRecentItems(items);
      return items;
    } catch (error) {
      console.error("Error al cargar elementos recientes:", error);
      return [];
    }
  }, []);

  /**
   * Obtener elementos recomendados
   * @param {number} [limit=10] - Cantidad máxima de elementos
   * @returns {Promise<Array>} - Elementos recomendados
   */
  const getRecommendations = useCallback(
    async (limit = 10) => {
      setLoading(true);
      try {
        return await mediaService.getRecommendations(limit);
      } catch (error) {
        showError("Error al obtener recomendaciones");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  /**
   * Obtener elementos populares
   * @param {number} [limit=10] - Cantidad máxima de elementos
   * @returns {Promise<Array>} - Elementos populares
   */
  const getPopularItems = useCallback(
    async (limit = 10) => {
      setLoading(true);
      try {
        return await mediaService.getPopularItems(limit);
      } catch (error) {
        showError("Error al obtener elementos populares");
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  /**
   * Eliminar un registro del historial
   * @param {number} historyId - ID del registro
   * @returns {Promise<Object>} - Resultado de la operación
   */
  const deleteHistoryItem = useCallback(
    async (historyId) => {
      try {
        const result = await mediaService.deleteHistoryItem(historyId);

        // Actualizar historial
        loadWatchHistory();

        return result;
      } catch (error) {
        showError("Error al eliminar elemento del historial");
        throw error;
      }
    },
    [loadWatchHistory, showError]
  );

  /**
   * Eliminar todo el historial de visualización
   * @returns {Promise<Object>} - Resultado de la operación
   */
  const clearWatchHistory = useCallback(async () => {
    try {
      const result = await mediaService.clearWatchHistory();

      // Actualizar estados
      setWatchHistory([]);
      setInProgressItems([]);
      refreshRecentItems();

      return result;
    } catch (error) {
      showError("Error al limpiar historial de visualización");
      throw error;
    }
  }, [refreshRecentItems, showError]);

  /**
   * Obtener estadísticas de visualización
   * @returns {Promise<Object>} - Estadísticas de visualización
   */
  const getUserWatchStats = useCallback(async () => {
    setLoading(true);
    try {
      return await mediaService.getUserWatchStats();
    } catch (error) {
      showError("Error al obtener estadísticas de visualización");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Valor que se proporcionará al contexto
  const value = {
    currentMedia,
    watchHistory,
    inProgressItems,
    recentItems,
    loading,
    getMediaById,
    searchMedia,
    getThumbnailUrl,
    getStreamUrl,
    getStreamingOptions,
    updateProgress,
    markAsWatched,
    loadWatchHistory,
    refreshInProgressItems,
    refreshRecentItems,
    getRecommendations,
    getPopularItems,
    deleteHistoryItem,
    clearWatchHistory,
    getUserWatchStats,
  };

  return (
    <MediaContext.Provider value={value}>{children}</MediaContext.Provider>
  );
};

export default MediaProvider;
