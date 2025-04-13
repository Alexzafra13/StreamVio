import React, { useState, useEffect, useContext } from 'react';
import { UIContext } from '../../context/UIContext';
import libraryService from '../../services/libraryService';
import MediaGrid from '../media/browser/MediaGrid';
import Card from '../ui/Card';
import Button from '../ui/Button';

/**
 * Componente para mostrar detalles de una biblioteca específica
 * 
 * @param {Object} props
 * @param {number} props.libraryId - ID de la biblioteca a mostrar
 */
const LibraryDetailComponent = ({ libraryId }) => {
  const [library, setLibrary] = useState(null);
  const [mediaItems, setMediaItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 24,
    total: 0,
    totalPages: 0
  });
  const [loading, setLoading] = useState(true);
  const [scanningStatus, setScanningStatus] = useState(null);
  const { showSuccess, showError } = useContext(UIContext);

  // Cargar datos de la biblioteca
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        setLoading(true);
        const libraryData = await libraryService.getLibraryById(libraryId);
        setLibrary(libraryData);
        
        // Cargar elementos multimedia de la biblioteca
        const mediaData = await libraryService.getLibraryMedia(libraryId, {
          page: pagination.page,
          limit: pagination.limit
        });
        
        setMediaItems(mediaData.items || []);
        setPagination(mediaData.pagination || pagination);
      } catch (error) {
        console.error('Error al cargar la biblioteca:', error);
        showError('No se pudo cargar la biblioteca');
      } finally {
        setLoading(false);
      }
    };

    if (libraryId) {
      loadLibrary();
    }
  }, [libraryId, pagination.page, pagination.limit]);

  // Iniciar un escaneo de la biblioteca
  const handleScan = async () => {
    try {
      setScanningStatus('scanning');
      await libraryService.scanLibrary(libraryId);
      showSuccess('Escaneo iniciado correctamente');
      
      // Simular progreso de escaneo por 5 segundos
      setTimeout(() => {
        setScanningStatus('completed');
        
        // Recargar datos después de completar
        setTimeout(() => {
          setScanningStatus(null);
          
          // Recargar datos
          libraryService.getLibraryMedia(libraryId, {
            page: pagination.page,
            limit: pagination.limit
          }).then(mediaData => {
            setMediaItems(mediaData.items || []);
            setPagination(mediaData.pagination || pagination);
          });
        }, 1000);
      }, 5000);
    } catch (error) {
      console.error('Error al iniciar escaneo:', error);
      showError('No se pudo iniciar el escaneo');
      setScanningStatus(null);
    }
  };

  // Enriquecer metadatos de la biblioteca
  const handleEnrich = async () => {
    try {
      setScanningStatus('enriching');
      await libraryService.enrichLibrary(libraryId);
      showSuccess('Enriquecimiento de metadatos iniciado correctamente');
      
      // Simular progreso por 5 segundos
      setTimeout(() => {
        setScanningStatus('completed');
        
        // Recargar datos después de completar
        setTimeout(() => {
          setScanningStatus(null);
          
          // Recargar datos
          libraryService.getLibraryMedia(libraryId, {
            page: pagination.page,
            limit: pagination.limit
          }).then(mediaData => {
            setMediaItems(mediaData.items || []);
            setPagination(mediaData.pagination || pagination);
          });
        }, 1000);
      }, 5000);
    } catch (error) {
      console.error('Error al enriquecer metadatos:', error);
      showError('No se pudo iniciar el enriquecimiento de metadatos');
      setScanningStatus(null);
    }
  };

  // Cambiar de página
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({
        ...prev,
        page: newPage
      }));
    }
  };

  // Mostrar mensaje de carga
  if (loading && !library) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-background-card rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-background-card rounded w-1/2 mb-6"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-background-card rounded"></div>
          ))}
        </div>
        <div className="h-64 bg-background-card rounded"></div>
      </div>
    );
  }

  // Mostrar mensaje si no se encuentra la biblioteca
  if (!loading && !library) {
    return (
      <Card>
        <div className="text-center py-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-text-secondary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-bold mb-2">Biblioteca no encontrada</h3>
          <p className="text-text-secondary mb-6">
            La biblioteca que buscas no existe o no tienes acceso a ella.
          </p>
          <Button as="a" href="/libraries" variant="primary">
            Ver todas las bibliotecas
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado de la biblioteca */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">{library?.name}</h1>
          <p className="text-text-secondary">{library?.path}</p>
          {library?.itemCount !== undefined && (
            <p className="text-sm text-text-secondary mt-1">
              {library.itemCount} elementos
            </p>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Botones de acción */}
          <Button 
            variant="ghost" 
            onClick={handleEnrich}
            disabled={scanningStatus !== null}
          >
            {scanningStatus === 'enriching' ? 'Enriqueciendo...' : 'Enriquecer metadatos'}
          </Button>
          
          <Button 
            variant="primary" 
            onClick={handleScan}
            disabled={scanningStatus !== null}
          >
            {scanningStatus === 'scanning' ? 'Escaneando...' : 
             scanningStatus === 'completed' ? 'Completado' : 'Escanear'}
          </Button>
          
          <Button as="a" href={`/libraries/edit/${libraryId}`} variant="secondary">
            Editar
          </Button>
        </div>
      </div>

      {/* Estado de escaneo */}
      {scanningStatus && scanningStatus !== 'completed' && (
        <Card className="mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary mr-3"></div>
            <div>
              {scanningStatus === 'scanning' ? 
                'Escaneando biblioteca. Esto puede tomar varios minutos...' : 
                'Enriqueciendo metadatos. Esto puede tomar varios minutos...'}
            </div>
          </div>
        </Card>
      )}

      {/* Contenido de la biblioteca */}
      <MediaGrid 
        items={mediaItems} 
        loading={loading && library} 
        showEmpty={true}
        emptyMessage={`No hay elementos en esta biblioteca "${library?.name}". Escanea la biblioteca para encontrar contenido.`}
        columns={4}
      />

      {/* Paginación */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              size="sm"
            >
              Anterior
            </Button>
            
            {[...Array(pagination.totalPages)].map((_, i) => (
              <Button 
                key={i}
                variant={pagination.page === i + 1 ? "primary" : "ghost"}
                onClick={() => handlePageChange(i + 1)}
                size="sm"
              >
                {i + 1}
              </Button>
            ))}
            
            <Button 
              variant="ghost" 
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              size="sm"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryDetailComponent;
