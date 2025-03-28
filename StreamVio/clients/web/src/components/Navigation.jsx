import React, { useState, useEffect } from 'react';

const Navigation = () => {
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Comprobar si hay un usuario en localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('streamvio_user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (e) {
        console.error("Error al obtener información de usuario:", e);
        localStorage.removeItem('streamvio_user');
      }
    }

    // Función para manejar cambios en el localStorage (para sincronizar estados entre pestañas)
    const handleStorageChange = () => {
      const userStr = localStorage.getItem('streamvio_user');
      if (userStr) {
        try {
          setUser(JSON.parse(userStr));
        } catch (e) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    // Escuchar cambios en localStorage
    window.addEventListener('storage', handleStorageChange);
    
    // Evento personalizado para cuando el login/logout sucede en la misma pestaña
    window.addEventListener('streamvio-auth-change', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('streamvio-auth-change', handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    // Eliminar datos de autenticación
    localStorage.removeItem('streamvio_token');
    localStorage.removeItem('streamvio_user');
    setUser(null);
    setDropdownOpen(false);
    
    // Disparar evento personalizado para notificar cambio de autenticación
    window.dispatchEvent(new Event('streamvio-auth-change'));
    
    // Redireccionar a la página principal
    window.location.href = '/';
  };

  const toggleDropdown = () => {
    setDropdownOpen(!dropdownOpen);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/media?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <header className="bg-gray-800 shadow-md sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <a href="/" className="text-2xl font-bold text-blue-500 flex items-center">
            <span className="sr-only">StreamVio</span>
            <svg className="h-8 w-8 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 8L12 4L20 8V16L12 20L4 16V8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 4V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 8L20 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 8L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">StreamVio</span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <ul className="flex space-x-6">
              <li><a href="/" className="hover:text-blue-400 transition">Inicio</a></li>
              <li><a href="/media?type=movie" className="hover:text-blue-400 transition">Películas</a></li>
              <li><a href="/media?type=series" className="hover:text-blue-400 transition">Series</a></li>
              <li><a href="/media?type=music" className="hover:text-blue-400 transition">Música</a></li>
              <li><a href="/media?type=photo" className="hover:text-blue-400 transition">Fotos</a></li>
            </ul>
            
            {/* Search Icon (Desktop) */}
            <button 
              onClick={() => setSearchOpen(!searchOpen)}
              className="text-gray-300 hover:text-white transition"
              aria-label="Buscar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </button>
            
            {/* User Menu (Desktop) */}
            {user ? (
              <div className="relative">
                <button 
                  onClick={toggleDropdown} 
                  className="flex items-center space-x-2 focus:outline-none"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="font-semibold text-sm">{user.username?.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="hidden md:inline">{user.username}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 py-2 bg-gray-700 rounded-md shadow-xl z-20">
                    <a href="/perfil" className="block px-4 py-2 text-sm hover:bg-gray-600 transition">
                      Mi Perfil
                    </a>
                    <a href="/bibliotecas" className="block px-4 py-2 text-sm hover:bg-gray-600 transition">
                      Gestionar Bibliotecas
                    </a>
                    <a href="/favoritos" className="block px-4 py-2 text-sm hover:bg-gray-600 transition">
                      Mis Favoritos
                    </a>
                    <a href="/historial" className="block px-4 py-2 text-sm hover:bg-gray-600 transition">
                      Historial
                    </a>
                    <div className="border-t border-gray-600 my-1"></div>
                    <button 
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-600 transition"
                    >
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <a href="/auth" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition">
                Iniciar Sesión
              </a>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center space-x-2">
            <button 
              onClick={() => setSearchOpen(!searchOpen)}
              className="text-gray-300 hover:text-white transition p-2"
              aria-label="Buscar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </button>
            
            {user && (
              <a href="/perfil" className="flex items-center p-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="font-semibold text-sm">{user.username?.charAt(0).toUpperCase()}</span>
                </div>
              </a>
            )}
            
            <button
              onClick={toggleMobileMenu}
              className="text-gray-300 hover:text-white p-2"
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar (shows when searchOpen is true) */}
      {searchOpen && (
        <div className="bg-gray-700 py-3 px-4">
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto">
            <div className="flex">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar películas, series, música..."
                className="w-full bg-gray-800 text-white border border-gray-600 rounded-l-md px-4 py-2 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-r-md hover:bg-blue-700 focus:outline-none"
              >
                Buscar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mobile Menu (shows when mobileMenuOpen is true) */}
      {mobileMenuOpen && (
        <nav className="md:hidden bg-gray-700 px-4 py-3">
          <ul className="space-y-3">
            <li><a href="/" className="block hover:text-blue-400 transition">Inicio</a></li>
            <li><a href="/media?type=movie" className="block hover:text-blue-400 transition">Películas</a></li>
            <li><a href="/media?type=series" className="block hover:text-blue-400 transition">Series</a></li>
            <li><a href="/media?type=music" className="block hover:text-blue-400 transition">Música</a></li>
            <li><a href="/media?type=photo" className="block hover:text-blue-400 transition">Fotos</a></li>
            
            {user ? (
              <>
                <li className="border-t border-gray-600 pt-2 mt-2">
                  <a href="/bibliotecas" className="block hover:text-blue-400 transition">Gestionar Bibliotecas</a>
                </li>
                <li>
                  <a href="/favoritos" className="block hover:text-blue-400 transition">Mis Favoritos</a>
                </li>
                <li>
                  <a href="/historial" className="block hover:text-blue-400 transition">Historial</a>
                </li>
                <li className="border-t border-gray-600 pt-2 mt-2">
                  <button
                    onClick={handleLogout}
                    className="text-red-400 hover:text-red-300 transition"
                  >
                    Cerrar Sesión
                  </button>
                </li>
              </>
            ) : (
              <li className="border-t border-gray-600 pt-2 mt-2">
                <a href="/auth" className="block text-blue-400 hover:text-blue-300 transition">
                  Iniciar Sesión
                </a>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
};

export default Navigation;