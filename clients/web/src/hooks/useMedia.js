// src/hooks/useMedia.js
import { useContext } from "react";
import { MediaContext } from "../context/MediaContext";

/**
 * Hook personalizado para acceder al contexto de contenido multimedia
 * Proporciona una forma sencilla de interactuar con elementos multimedia,
 * historial de visualización y operaciones relacionadas
 *
 * @returns {Object} Funciones y estado para gestión de contenido multimedia
 */
export const useMedia = () => {
  const context = useContext(MediaContext);

  if (!context) {
    throw new Error("useMedia debe ser usado dentro de un MediaProvider");
  }

  return {
    // Estado actual
    currentMedia: context.currentMedia,
    watchHistory: context.watchHistory,
    inProgressItems: context.inProgressItems,
    recentItems: context.recentItems,
    loading: context.loading,

    // Obtención de elementos
    getMediaById: context.getMediaById,
    searchMedia: context.searchMedia,

    // URLs para recursos
    getThumbnailUrl: context.getThumbnailUrl,
    getStreamUrl: context.getStreamUrl,
    getStreamingOptions: context.getStreamingOptions,

    // Gestión de progreso
    updateProgress: context.updateProgress,
    markAsWatched: context.markAsWatched,

    // Historial y recomendaciones
    loadWatchHistory: context.loadWatchHistory,
    refreshInProgressItems: context.refreshInProgressItems,
    refreshRecentItems: context.refreshRecentItems,
    getRecommendations: context.getRecommendations,
    getPopularItems: context.getPopularItems,

    // Gestión de historial
    deleteHistoryItem: context.deleteHistoryItem,
    clearWatchHistory: context.clearWatchHistory,
    getUserWatchStats: context.getUserWatchStats,
  };
};

export default useMedia;
