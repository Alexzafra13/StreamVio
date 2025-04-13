// src/components/layout/Header.jsx
import React, { useState, useContext, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useUI } from '../../hooks/useUI.js';
import { useMedia } from '../../hooks/useMedia.js';

/**
 * Componente de encabezado principal con navegación y búsqueda
 * 
 * @param {Object} props
 * @param {string} props.title - Título de la página actual
 */
const Header = ({ title = 'Dashboard' }) => {
  const { user, isAdmin } = useAuth();
  const { toggleSidebar, isLoading, setIsLoading } = useUI();
  const { searchMedia } = useMedia();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);
  
  // Cerrar resultados al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  // Manejar cambio en el input de búsqueda
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Limpiar timeout previo
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    if (value.length >= 2) {
      setIsSearching(true);
      
      // Realizar búsqueda después de un pequeño retraso para evitar demasiadas peticiones
      searchTimeout.current = setTimeout(async () => {
        try {
          const results = await searchMedia({ 
            query: value,
            limit: 5 
          });
          
          setSearchResults(results.items || []);
          setShowResults(true);
        } catch (error) {
          console.error('Error al buscar:', error);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    } else {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
    }
  };
  
  // Ir a la página de búsqueda
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/media?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <header className="bg-background-card border-b border-gray-700">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Botón menú móvil y título */}
        <div className="flex items-center">
          <button 
            onClick={toggleSidebar}
            className="lg:hidden mr-3 text-text-secondary hover:text-text-primary"
            aria-label="Menú"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
        </div>
        
        {/* Búsqueda y acciones */}
        <div className="flex items-center space-x-4">
          {/* Búsqueda */}
          <div className="relative" ref={searchRef}>
            <form onSubmit={handleSearch}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-40 sm:w-64 md:w-80 pl-10 pr-4 py-2 bg-background-dark rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  onFocus={() => {
                    if (searchResults.length > 0) {
                      setShowResults(true);
                    }
                  }}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {isSearching ? (
                    <div className="animate-spin h-4 w-4 border-2 border-primary rounded-full border-t-transparent"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </div>
              </div>
            </form>
            
            {/* Resultados de búsqueda */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute mt-1 w-full bg-background-card rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                <ul className="py-1">
                  {searchResults.map((item) => (
                    <li key={item.id} className="border-b border-gray-700 last:border-0">
                      <a 
                        href={`/media/${item.id}`}
                        className="flex items-center px-4 py-2 hover:bg-background-dark"
                        onClick={() => setShowResults(false)}
                      >
                        {/* Miniatura */}
                        <div className="w-12 h-16 bg-background-dark rounded overflow-hidden flex-shrink-0">
                          {item.thumbnail_path ? (
                            <img 
                              src={item.thumbnail_path} 
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        
                        {/* Información */}
                        <div className="ml-3 flex-1">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-text-secondary flex items-center mt-1">
                            <span className="capitalize mr-2">
                              {item.type === 'movie' ? 'Película' : 
                               item.type === 'series' ? 'Serie' : 
                               item.type === 'episode' ? 'Episodio' : 
                               item.type}
                            </span>
                            {item.year && <span>• {item.year}</span>}
                          </div>
                        </div>
                      </a>
                    </li>
                  ))}
                  
                  {/* Ver todos los resultados */}
                  <li>
                    <a 
                      href={`/media?q=${encodeURIComponent(searchQuery)}`}
                      className="block px-4 py-2 text-primary hover:bg-background-dark text-center"
                      onClick={() => setShowResults(false)}
                    >
                      Ver todos los resultados
                    </a>
                  </li>
                </ul>
              </div>
            )}
          </div>
          
          {/* Indicador de carga global */}
          {isLoading && (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
          )}
          
          {/* Enlace de administración (si es admin) */}
          {isAdmin() && (
            <a 
              href="/admin/users" 
              className="hidden sm:flex items-center text-text-secondary hover:text-text-primary"
              title="Panel de administración"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </a>
          )}
          
          {/* Avatar de usuario (si hay usuario) */}
          {user && (
            <div className="relative">
              <a href="/profile" className="block" title={user.username || 'Perfil'}>
                <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center">
                  {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;