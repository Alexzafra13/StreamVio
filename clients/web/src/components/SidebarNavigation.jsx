// clients/web/src/components/SidebarNavigation.jsx
import React, { useState, useEffect } from "react";

/**
 * Navegación lateral al estilo Plex/Jellyfin
 */
const SidebarNavigation = () => {
  const [user, setUser] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Detectar si es una pantalla móvil
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setExpanded(false);
      }
    };

    // Establecer el estado inicial
    handleResize();

    // Escuchar cambios de tamaño de ventana
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Comprobar si hay un usuario en localStorage
  useEffect(() => {
    const userStr = localStorage.getItem("streamvio_user");
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (e) {
        console.error("Error al obtener información de usuario:", e);
        localStorage.removeItem("streamvio_user");
      }
    }

    // Función para manejar cambios en el localStorage
    const handleStorageChange = () => {
      const userStr = localStorage.getItem("streamvio_user");
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
    window.addEventListener("storage", handleStorageChange);

    // Evento personalizado para cuando el login/logout sucede en la misma pestaña
    window.addEventListener("streamvio-auth-change", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("streamvio-auth-change", handleStorageChange);
    };
  }, []);

  const handleLogout = () => {
    // Eliminar datos de autenticación
    localStorage.removeItem("streamvio_token");
    localStorage.removeItem("streamvio_user");
    setUser(null);

    // Disparar evento personalizado para notificar cambio de autenticación
    window.dispatchEvent(new Event("streamvio-auth-change"));

    // Redireccionar a la página principal
    window.location.href = "/";
  };

  const toggleSidebar = () => {
    setExpanded(!expanded);
  };

  const toggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/media?search=${encodeURIComponent(searchQuery)}`;
      setSearchOpen(false);
      setShowMobileSidebar(false);
    }
  };

  // Estilo dinámico para el sidebar dependiendo de si está expandido
  const sidebarClasses = `sidebar bg-gray-900 shadow-lg fixed left-0 top-0 h-full z-50 transition-all duration-300 
    ${expanded ? "w-64" : "w-16"} 
    ${
      isMobile
        ? showMobileSidebar
          ? "translate-x-0"
          : "-translate-x-full"
        : "translate-x-0"
    }`;

  return (
    <>
      {/* Botón de menú para móvil */}
      <button
        onClick={toggleMobileSidebar}
        className="md:hidden fixed top-4 left-4 z-50 bg-gray-800 text-white p-2 rounded-md"
        aria-label="Menú principal"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16m-7 6h7"
          />
        </svg>
      </button>

      {/* Sidebar */}
      <div className={sidebarClasses}>
        <div className="sidebar-content flex flex-col h-full">
          {/* Cabecera del sidebar */}
          <div className="sidebar-header flex items-center justify-between px-4 py-5 border-b border-gray-800">
            <div className="flex items-center">
              <a
                href="/"
                className="text-xl font-bold text-blue-500 flex items-center"
              >
                <svg
                  className="h-8 w-8 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 8L12 4L20 8V16L12 20L4 16V8Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 4V20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 8L20 16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 8L4 16"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {expanded && <span>StreamVio</span>}
              </a>
            </div>

            {/* Botón para expandir/contraer el sidebar (solo escritorio) */}
            {!isMobile && (
              <button
                onClick={toggleSidebar}
                className="text-gray-400 hover:text-white"
                aria-label={expanded ? "Contraer menú" : "Expandir menú"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-5 w-5 transition-transform ${
                    expanded ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            {/* Botón para cerrar el sidebar en móvil */}
            {isMobile && (
              <button
                onClick={toggleMobileSidebar}
                className="text-gray-400 hover:text-white"
                aria-label="Cerrar menú"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Sección de navegación principal */}
          <div className="sidebar-menu flex-grow overflow-y-auto py-4">
            <h2
              className={`text-xs uppercase text-gray-500 font-semibold px-4 mb-2 ${
                !expanded && "sr-only"
              }`}
            >
              Explorar
            </h2>

            <ul>
              <li>
                <a
                  href="/"
                  className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-blue-400 transition-colors rounded-lg mx-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  {expanded && <span className="ml-3">Inicio</span>}
                </a>
              </li>
              <li>
                <a
                  href="/media?type=movie"
                  className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-blue-400 transition-colors rounded-lg mx-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                    />
                  </svg>
                  {expanded && <span className="ml-3">Películas</span>}
                </a>
              </li>
              <li>
                <a
                  href="/media?type=series"
                  className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-blue-400 transition-colors rounded-lg mx-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  {expanded && <span className="ml-3">Series</span>}
                </a>
              </li>
              <li>
                <a
                  href="/media?type=music"
                  className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-blue-400 transition-colors rounded-lg mx-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                    />
                  </svg>
                  {expanded && <span className="ml-3">Música</span>}
                </a>
              </li>
            </ul>

            {user && (
              <>
                <h2
                  className={`text-xs uppercase text-gray-500 font-semibold px-4 mb-2 mt-6 ${
                    !expanded && "sr-only"
                  }`}
                >
                  Tu biblioteca
                </h2>
                <ul>
                  <li>
                    <a
                      href="/favoritos"
                      className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-blue-400 transition-colors rounded-lg mx-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                        />
                      </svg>
                      {expanded && <span className="ml-3">Favoritos</span>}
                    </a>
                  </li>
                  <li>
                    <a
                      href="/historial"
                      className="flex items-center px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-blue-400 transition-colors rounded-lg mx-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {expanded && <span className="ml-3">Historial</span>}
                    </a>
                  </li>
                </ul>
              </>
            )}

            {/* Búsqueda - siempre visible en escritorio si el sidebar está expandido */}
            {(expanded || searchOpen) && !isMobile && (
              <div className="px-4 mt-6">
                <form onSubmit={handleSearch} className="flex">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full bg-gray-800 text-white border border-gray-700 rounded-l px-4 py-2 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700 focus:outline-none"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Búsqueda en modo móvil */}
          {isMobile && searchOpen && (
            <div className="px-4 py-3 border-t border-gray-800">
              <form onSubmit={handleSearch} className="flex">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-gray-800 text-white border border-gray-700 rounded-l px-4 py-2 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-r hover:bg-blue-700 focus:outline-none"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              </form>
            </div>
          )}

          {/* Footer del sidebar */}
          <div className="sidebar-footer border-t border-gray-800 py-2 px-4">
            {/* Botón de búsqueda (solo visible en versión colapsada o en móvil) */}
            {(!expanded || isMobile) && (
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="w-full flex items-center justify-center px-4 py-2 text-gray-300 hover:text-blue-400 transition-colors"
                aria-label="Buscar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            )}

            {/* Menú de usuario */}
            {user ? (
              <div className={`py-2 ${expanded ? "px-2" : "px-0 text-center"}`}>
                <div
                  className={`flex ${
                    expanded
                      ? "items-center"
                      : "flex-col items-center justify-center"
                  }`}
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="font-semibold text-sm">
                      {user.username?.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {expanded && (
                    <div className="ml-2 flex-grow">
                      <div className="font-medium text-sm">{user.username}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {user.email}
                      </div>
                    </div>
                  )}
                </div>

                <div className={`mt-2 ${expanded ? "" : "sr-only"}`}>
                  <a
                    href="/perfil"
                    className="text-sm text-gray-400 hover:text-blue-400 block py-1"
                  >
                    Mi Perfil
                  </a>
                  <a
                    href="/bibliotecas"
                    className="text-sm text-gray-400 hover:text-blue-400 block py-1"
                  >
                    Mis Bibliotecas
                  </a>
                  {user.is_admin === 1 && (
                    <a
                      href="/admin"
                      className="text-sm text-gray-400 hover:text-blue-400 block py-1"
                    >
                      Administración
                    </a>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-sm text-red-400 hover:text-red-300 block py-1 w-full text-left"
                  >
                    Cerrar Sesión
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-2 text-center">
                <a
                  href="/auth"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded inline-block transition w-full text-center"
                >
                  {expanded ? (
                    "Iniciar Sesión"
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mx-auto"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                      />
                    </svg>
                  )}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay para cerrar el sidebar en móvil */}
      {isMobile && showMobileSidebar && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={toggleMobileSidebar}
        ></div>
      )}

      {/* Espacio reservado para el sidebar (solo escritorio) */}
      {!isMobile && (
        <div
          className={`transition-all duration-300 ${
            expanded ? "ml-64" : "ml-16"
          }`}
        ></div>
      )}
    </>
  );
};

export default SidebarNavigation;
