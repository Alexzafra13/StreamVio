// clients/web/src/layouts/SidebarLayout.jsx
import React from "react";
import SidebarNavigation from "../components/SidebarNavigation";

const SidebarLayout = ({ children, title }) => {
  return (
    <div className="min-h-screen bg-gray-800 text-white flex">
      {/* Sidebar de navegación */}
      <SidebarNavigation />

      {/* Contenido principal */}
      <div className="flex-grow min-h-screen">
        {/* Ajuste de margen para compensar el sidebar */}
        <div className="md:ml-16 transition-all duration-300">
          {" "}
          {/* Sidebar colapsado por defecto */}
          {/* Contenedor del contenido */}
          <div className="container mx-auto px-4 py-8">
            {title && (
              <h1 className="text-3xl font-bold mb-8 text-center text-blue-500 pt-12 md:pt-0">
                {title}
              </h1>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarLayout;
