// src/components/layout/Sidebar.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { useUI } from '../../hooks/useUI.js';

/**
 * Componente de barra lateral para navegación principal
 * 
 * @param {Object} props
 * @param {Array} props.navItems - Elementos de navegación principal
 * @param {Array} props.adminItems - Elementos de navegación de administración
 */
const Sidebar = ({ navItems = [], adminItems = [] }) => {
  const { user, isAdmin, logout } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen, theme, toggleTheme } = useUI();
  const [activeItem, setActiveItem] = useState('/');
  
  // Detectar la ruta activa
  useEffect(() => {
    const pathname = window.location.pathname;
    setActiveItem(pathname);
  }, []);

  // Manejar cierre de sesión
  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Obtener el icono para un elemento de navegación
  const getIcon = (iconName) => {
    switch (iconName) {
      case 'home':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-14 0l2 2m0 0l7 7 7-7m-14 0l2-2" />
          </svg>
        );
      case 'folder':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
        );
      case 'film':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        );
      case 'tv':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
          </svg>
        );
      case 'history':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'users':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case 'settings':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'server':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
    }
  };

  return (
    <>
      {/* Sidebar para móvil (overlay) */}
      <div 
        className={`${
          isSidebarOpen ? 'fixed inset-0 z-40 bg-black bg-opacity-50' : 'hidden'
        } lg:hidden`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-background-dark border-r border-gray-700 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Logo */}
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-700">
            <div className="flex justify-between items-center">
              <a href="/" className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
                <span className="text-xl font-bold">StreamVio</span>
              </a>
              
              {/* Botón cerrar solo en móvil */}
              <button 
                className="lg:hidden text-text-secondary hover:text-text-primary"
                onClick={() => setIsSidebarOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Navegación principal */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    className={`sidebar-link ${
                      activeItem === item.path ? 'active' : ''
                    }`}
                  >
                    {getIcon(item.icon)}
                    {item.name}
                  </a>
                </li>
              ))}
            </ul>

            {/* Sección de administración solo para admins */}
            {isAdmin() && adminItems.length > 0 && (
              <>
                <div className="mt-8 mb-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Administración
                </div>
                <ul className="space-y-1">
                  {adminItems.map((item) => (
                    <li key={item.path}>
                      <a
                        href={item.path}
                        className={`sidebar-link ${
                          activeItem === item.path ? 'active' : ''
                        }`}
                      >
                        {getIcon(item.icon)}
                        {item.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </nav>

          {/* Perfil de usuario */}
          <div className="p-4 border-t border-gray-700">
            {user ? (
              <div className="flex flex-col">
                <div className="flex items-center mb-2">
                  <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center">
                    {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="ml-2">
                    <div className="font-medium text-text-primary">{user.username}</div>
                    <div className="text-xs text-text-secondary">{user.email}</div>
                  </div>
                </div>
                
                <div className="flex items-center mt-2 justify-between">
                  {/* Botón para cambiar tema */}
                  <button 
                    onClick={toggleTheme}
                    className="text-text-secondary hover:text-text-primary text-sm"
                  >
                    {theme === 'dark' ? (
                      <span className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Claro
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                        Oscuro
                      </span>
                    )}
                  </button>
                  
                  {/* Botón para cerrar sesión */}
                  <button 
                    onClick={handleLogout}
                    className="text-text-secondary hover:text-text-primary text-sm"
                  >
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar sesión
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <a 
                  href="/login" 
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
                >
                  Iniciar sesión
                </a>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;