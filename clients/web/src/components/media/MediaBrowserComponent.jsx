import React, { useState, useEffect, useContext } from 'react';
import { UIContext } from '../../context/UIContext.jsx';
import MediaGrid from './browser/MediaGrid.jsx';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import mediaService from '../../services/mediaService.js';
import libraryService from '../../services/libraryService.js';

/**
 * Componente para explorar y buscar contenido multimedia
 * 
 * @param {Object} props
 * @param {string} props.initialQuery - Consulta inicial de búsqueda
 * @param {string} props.initialType - Tipo inicial de contenido a filtrar
 * @param {string} props.initialLibrary - ID inicial de biblioteca a filtrar
 */
const MediaBrowserComponent = ({ initialQuery = '', initialType = '', initialLibrary = '' }) => {
  // Estados
  const [libraries, setLibraries] = useState([]);
  const [mediaItems, setMediaItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 24,
    total: 0,
    totalPages: 0
  });
  const [searchParams, setSearchParams] = useState({
    query: initialQuery,
    type: initialType,
    library: initialLibrary,
    sort: 'title',
    order: 'asc'
  });
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showError } = useContext(UIContext);

  // Cargar bibliotecas disponibles
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        const data = await libraryService.getAllLibraries();
        setLibraries(data || []);
      } catch (error) {
        console.error('Error al cargar bibliotecas:', error);
      }
    };

    loadLibraries();
  }, []);

  // Cargar contenido multimedia con los parámetros actuales
  useEffect(() => {
    const loadMedia = async () => {
      try {
        setLoading(true);
        
        // Preparar parámetros de búsqueda
        const params = {
          ...searchParams,
          page: pagination.page,
          limit: pagination.limit
        };
        
        // Eliminar parámetros vacíos
        Object.keys(params).forEach(key => 
          (params[key] === '' || params[key] === null) && delete params[key]
        );
        
        // Realizar búsqueda
        const results = await mediaService.searchMedia(params);
        
        // Actualizar estado
        setMediaItems(results.items || []);
        setPagination({
          ...pagination,
          total: results.pagination?.total || 0,
          totalPages: results.pagination?.totalPages || 0
        });
        
        // Actualizar URL con parámetros de búsqueda
        updateUrl();
      } catch (error) {
        console.error('Error al buscar contenido:', error);
        showError('Error al buscar contenido multimedia');
      } finally {
        setLoading(false);
        setIsSearching(false);
      }
    };

    loadMedia();
  }, [searchParams, pagination.page, pagination.limit]);

  // Actualizar la URL con los parámetros de búsqueda
  const updateUrl = () => {
    const url = new URL(window.location);
    
    // Añadir/actualizar parámetros en la URL
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
    });
    
    // Actualizar la URL sin recargar la página
    window.history.replaceState({}, '', url);
  };

  // Manejar cambios en el formulario de búsqueda
  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Manejar envío del formulario de búsqueda
  const handleSearch = (e) => {
    e.preventDefault();
    setIsSearching(true);
    
    // Resetear a primera página al realizar una nueva búsqueda
    setPagination(prev => ({
      ...prev,
      page: 1
    }));
  };

  // Manejar cambio de página
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({
        ...prev,
        page: newPage
      }));
    }
  };

  // Manejar cambio de ordenación
  const handleSortChange = (sort, order) => {
    setSearchParams(prev => ({
      ...prev,
      sort,
      order
    }));
  };

  // Obtener título de la página según los filtros
  const getPageTitle = () => {
    if (searchParams.query) {
      return `Búsqueda: "${searchParams.query}"`;
    }
    
    if (searchParams.type) {
      const typeLabels = {
        'movie': 'Películas',
        'series': 'Series',
        'episode': 'Episodios',
        'music': 'Música',
        'photo': 'Fotos'
      };
      return typeLabels[searchParams.type] || 'Contenido multimedia';
    }
    
    return 'Todo el contenido';
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y filtros */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <h1 className="text-2xl font-bold">{getPageTitle()}</h1>
        
        <Card className="w-full lg:w-auto p-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
            {/* Campo de búsqueda */}
            <div className="w-full md:w-auto flex-1">
              <input
                type="text"
                name="query"
                value={searchParams.query}
                onChange={handleSearchChange}
                placeholder="Buscar título, actor, director..."
                className="w-full px-4 py-2 bg-background-dark border border-gray-700 rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            
            {/* Selector de tipo */}
            <div className="w-full sm:w-auto">
              <select
                name="type"
                value={searchParams.type}
                onChange={handleSearchChange}
                className="w-full px-4 py-2 bg-background-dark border border-gray-700 rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todos los tipos</option>
                <option value="movie">Películas</option>
                <option value="series">Series</option>
                <option value="episode">Episodios</option>
                <option value="music">Música</option>
                <option value="photo">Fotos</option>
              </select>
            </div>
            
            {/* Selector de biblioteca */}
            <div className="w-full sm:w-auto">
              <select
                name="library"
                value={searchParams.library}
                onChange={handleSearchChange}
                className="w-full px-4 py-2 bg-background-dark border border-gray-700 rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Todas las bibliotecas</option>
                {libraries.map(lib => (
                  <option key={lib.id} value={lib.id}>{lib.name}</option>
                ))}
              </select>
            </div>
            
            {/* Botón de búsqueda */}
            <Button 
              type="submit" 
              variant="primary"
              isLoading={isSearching}
            >
              Buscar
            </Button>
          </form>
        </Card>
      </div>

      {/* Ordenación */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-text-secondary">
          {pagination.total > 0 ? (
            <span>Mostrando {Math.min(pagination.limit, pagination.total)} de {pagination.total} elementos</span>
          ) : (
            <span>No se encontraron elementos</span>
          )}
        </div>
        
        <div className="flex space-x-2 text-sm">
          <span className="text-text-secondary">Ordenar:</span>
          <button 
            className={`${searchParams.sort === 'title' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            onClick={() => handleSortChange('title', searchParams.sort === 'title' && searchParams.order === 'asc' ? 'desc' : 'asc')}
          >
            Título {searchParams.sort === 'title' && (searchParams.order === 'asc' ? '↑' : '↓')}
          </button>
          <span className="text-text-secondary">|</span>
          <button 
            className={`${searchParams.sort === 'year' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            onClick={() => handleSortChange('year', searchParams.sort === 'year' && searchParams.order === 'asc' ? 'desc' : 'asc')}
          >
            Año {searchParams.sort === 'year' && (searchParams.order === 'asc' ? '↑' : '↓')}
          </button>
          <span className="text-text-secondary">|</span>
          <button 
            className={`${searchParams.sort === 'created_at' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}`}
            onClick={() => handleSortChange('created_at', searchParams.sort === 'created_at' && searchParams.order === 'asc' ? 'desc' : 'asc')}
          >
            Añadido {searchParams.sort === 'created_at' && (searchParams.order === 'asc' ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {/* Resultados */}
      <MediaGrid 
        items={mediaItems} 
        loading={loading} 
        showEmpty={true}
        emptyMessage="No se encontraron elementos que coincidan con tu búsqueda"
        columns={5}
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
            
            {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
              // Mostrar 5 páginas centradas en la actual
              let pageToShow;
              if (pagination.totalPages <= 5) {
                pageToShow = i + 1;
              } else {
                const start = Math.max(1, pagination.page - 2);
                const end = Math.min(pagination.totalPages, start + 4);
                pageToShow = start + i;
                if (pageToShow > end) return null;
              }
              
              return (
                <Button 
                  key={pageToShow}
                  variant={pagination.page === pageToShow ? "primary" : "ghost"}
                  onClick={() => handlePageChange(pageToShow)}
                  size="sm"
                >
                  {pageToShow}
                </Button>
              );
            })}
            
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

export default MediaBrowserComponent;