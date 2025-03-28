import React, { useState, useEffect } from 'react';

const Navigation = () => {
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Como este componente se carga en Astro, no podemos usar el hook useAuth directamente
  // En lugar de eso, usamos localStorage para determinar el estado de autenticación
  useEffect(() => {
    // Verificar si hay un usuario en localStorage
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

  return (
    <header className="bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <a href="/" className="text-2xl font-bold text-blue-500">StreamVio</a>
        
        <nav className="flex items-center space-x-6">
          <ul className="flex space-x-6">
            <li><a href="/" className="hover:text-blue-400 transition">Inicio</a></li>
            <li><a href="#" className="hover:text-blue-400 transition">Películas</a></li>
            <li><a href="#" className="hover:text-blue-400 transition">Series</a></li>
          </ul>
          
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
      </div>
    </header>
  );
};

export default Navigation;