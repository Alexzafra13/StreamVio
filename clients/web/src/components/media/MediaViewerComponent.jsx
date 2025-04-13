import React, { useState, useEffect, useContext } from 'react';
import { UIContext } from '../../context/UIContext';
import { MediaContext } from '../../context/MediaContext';
import mediaService from '../../services/mediaService';
import MediaDetails from './details/MediaDetails';
import VideoPlayer from './player/VideoPlayer';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Componente para visualizar y reproducir detalles de un elemento multimedia
 * 
 * @param {Object} props
 * @param {number} props.mediaId - ID del elemento multimedia a mostrar
 */
export const MediaViewerComponent = ({ mediaId }) => {
  // Estados
  const [media, setMedia] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [streamType, setStreamType] = useState('direct');
  const [streamOptions, setStreamOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streamLoading, setStreamLoading] = useState(false);
  
  // Contextos
  const { showError } = useContext(UIContext);
  const { updateProgress } = useContext(MediaContext);

  // Cargar datos del medio
  useEffect(() => {
    const loadMedia = async () => {
      try {
        setLoading(true);
        const mediaData = await mediaService.getMediaById(mediaId);
        setMedia(mediaData);
        
        // Intentar cargar opciones de streaming disponibles
        try {
          const options = await mediaService.getStreamingOptions(mediaId);
          setStreamOptions(options || []);
        } catch (error) {
          console.error('Error al cargar opciones de streaming:', error);
        }
      } catch (error) {
        console.error('Error al cargar medio:', error);
        showError('No se pudo cargar el contenido multimedia');
      } finally {
        setLoading(false);
      }
    };

    if (mediaId) {
      loadMedia();
    }
  }, [mediaId]);

  // Iniciar reproducción
  const handlePlay = async (startTime = 0) => {
    try {
      setStreamLoading(true);
      
      // Seleccionar URL de streaming
      let url;
      if (streamOptions.length > 0) {
        // Usar la primera opción disponible o HLS si está disponible
        const hlsOption = streamOptions.find(opt => opt.type === 'hls');
        const selectedOption = hlsOption || streamOptions[0];
        
        url = selectedOption.url;
        setStreamType(selectedOption.type === 'hls' ? 'application/x-mpegURL' : 'video/mp4');
      } else {
        // Usar URL predeterminada
        url = mediaService.getStreamUrl(mediaId, streamType === 'application/x-mpegURL' ? 'hls' : 'direct');
      }
      
      setStreamUrl(url);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error al iniciar reproducción:', error);
      showError('Error al iniciar la reproducción');
    } finally {
      setStreamLoading(false);
    }
  };

  // Detener reproducción
  const handleStopPlayback = () => {
    setIsPlaying(false);
    setStreamUrl(null);
  };

  // Actualizar progreso de visualización
  const handleTimeUpdate = (currentTime, duration) => {
    // Actualizar cada 5 segundos para evitar demasiadas peticiones
    if (Math.floor(currentTime) % 5 === 0) {
      updateProgress(mediaId, currentTime);
    }
  };

  // Manejar cuando finaliza la reproducción
  const handleEnded = () => {
    // Marcar como completado
    updateProgress(mediaId, media?.duration || 0, true);
    setIsPlaying(false);
  };

  // Mostrar mensaje de carga
  if (loading && !media) {
    return (
      <div className="animate-pulse">
        <div className="h-96 bg-background-card rounded-lg mb-6"></div>
        <div className="h-8 bg-background-card rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-background-card rounded w-1/2 mb-8"></div>
        <div className="h-4 bg-background-card rounded w-full mb-2"></div>
        <div className="h-4 bg-background-card rounded w-full mb-2"></div>
        <div className="h-4 bg-background-card rounded w-3/4"></div>
      </div>
    );
  }

  // Mostrar mensaje si no se encuentra el medio
  if (!loading && !media) {
    return (
      <Card>
        <div className="text-center py-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-text-secondary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-bold mb-2">Elemento no encontrado</h3>
          <p className="text-text-secondary mb-6">
            El elemento multimedia que buscas no existe o no tienes acceso a él.
          </p>
          <Button as="a" href="/media" variant="primary">
            Ver todo el contenido
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      {/* Reproductor de video (cuando está reproduciendo) */}
      {isPlaying && streamUrl && (
        <Card className="mb-6 p-0 overflow-hidden">
          <div className="aspect-video bg-black relative">
            {streamLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <VideoPlayer 
                src={streamUrl}
                type={streamType}
                poster={media.thumbnail_path}
                startTime={media.watchProgress?.position || 0}
                autoplay={true}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
              />
            )}
          </div>
          
          <div className="p-4 flex justify-between items-center">
            <h2 className="text-lg font-bold">{media.title}</h2>
            <Button variant="ghost" onClick={handleStopPlayback}>
              Cerrar
            </Button>
          </div>
        </Card>
      )}

      {/* Detalles del medio */}
      <MediaDetails 
        media={media} 
        onPlay={handlePlay}
      />
    </div>
  );
};

export default MediaViewerComponent;