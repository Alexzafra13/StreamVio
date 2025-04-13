import React, { useState, useEffect, useContext } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import { UIContext } from "../../context/UIContext.jsx";
import settingsService from "../../services/settingsService.js";

/**
 * Componente para configurar ajustes del sistema (solo para administradores)
 */
const SystemSettings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsGroups, setSettingsGroups] = useState({});
  const [activeTab, setActiveTab] = useState("general");
  const { showSuccess, showError } = useContext(UIContext);

  // Cargar configuraciones al montar el componente
  useEffect(() => {
    fetchSettings();
  }, []);

  // Obtener todas las configuraciones
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsService.getGroupedSettings();
      setSettingsGroups(data);

      // Unificar todas las configuraciones en un solo objeto
      const allSettings = {};
      Object.keys(data).forEach((group) => {
        data[group].forEach((setting) => {
          allSettings[setting.key] = setting.value;
        });
      });

      setSettings(allSettings);
    } catch (error) {
      console.error("Error al cargar configuraciones:", error);
      showError("No se pudieron cargar las configuraciones");
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambios en los inputs
  const handleInputChange = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Guardar configuraciones
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await settingsService.setBulkSettings({ settings });
      showSuccess("Configuraciones guardadas correctamente");
    } catch (error) {
      console.error("Error al guardar configuraciones:", error);
      showError("Error al guardar las configuraciones");
    } finally {
      setSaving(false);
    }
  };

  // Restablecer todas las configuraciones a valores por defecto
  const handleResetAll = async () => {
    if (
      window.confirm(
        "¿Estás seguro de restablecer todas las configuraciones a valores por defecto?"
      )
    ) {
      try {
        setSaving(true);
        await settingsService.resetAllSettings();
        showSuccess("Configuraciones restablecidas correctamente");
        fetchSettings(); // Recargar
      } catch (error) {
        console.error("Error al restablecer configuraciones:", error);
        showError("Error al restablecer las configuraciones");
      } finally {
        setSaving(false);
      }
    }
  };

  // Restablecer una configuración específica
  const handleResetSetting = async (key) => {
    try {
      await settingsService.resetSetting(key);
      showSuccess(`Configuración "${key}" restablecida`);
      fetchSettings(); // Recargar
    } catch (error) {
      console.error(`Error al restablecer configuración ${key}:`, error);
      showError("Error al restablecer la configuración");
    }
  };

  // Renderizar controles de configuración según su tipo
  const renderSettingControl = (setting) => {
    const { key, value, description } = setting;
    const currentValue = settings[key] !== undefined ? settings[key] : value;

    // Determinar tipo de valor
    let inputType = "text";
    let inputComponent = null;

    if (typeof currentValue === "boolean") {
      // Toggle para booleanos
      inputComponent = (
        <div className="flex items-center">
          <input
            id={key}
            type="checkbox"
            checked={currentValue}
            onChange={(e) => handleInputChange(key, e.target.checked)}
            className="h-4 w-4 text-primary focus:ring-primary rounded bg-background-dark border-gray-700"
          />
          <label htmlFor={key} className="ml-2 text-sm text-text-secondary">
            {currentValue ? "Activado" : "Desactivado"}
          </label>
        </div>
      );
    } else if (typeof currentValue === "number") {
      // Input numérico
      inputType = "number";
      inputComponent = (
        <input
          id={key}
          type="number"
          value={currentValue}
          onChange={(e) => handleInputChange(key, Number(e.target.value))}
          className="w-full px-4 py-2 bg-background-dark border border-gray-700 rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      );
    } else if (typeof currentValue === "string") {
      // Detectar si es una selección enumerada
      if (
        key.includes("type") ||
        key.includes("mode") ||
        key.includes("quality")
      ) {
        // Opciones para selecciones comunes
        let options = [];

        if (key === "theme") {
          options = ["dark", "light"];
        } else if (key === "default_streaming_quality") {
          options = ["auto", "low", "medium", "high"];
        } else if (key === "log_level") {
          options = ["debug", "info", "warn", "error"];
        } else if (key === "preferred_video_codec") {
          options = ["h264", "h265", "vp9", "av1"];
        } else if (key === "preferred_audio_codec") {
          options = ["aac", "mp3", "opus", "flac"];
        } else if (key === "metadata_language") {
          options = ["es", "en", "fr", "de", "it", "pt"];
        } else if (key === "hw_acceleration") {
          options = ["auto", "nvenc", "qsv", "vaapi", "none"];
        }

        if (options.length > 0) {
          inputComponent = (
            <select
              id={key}
              value={currentValue}
              onChange={(e) => handleInputChange(key, e.target.value)}
              className="w-full px-4 py-2 bg-background-dark border border-gray-700 rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </select>
          );
        } else {
          // Input de texto estándar
          inputComponent = (
            <input
              id={key}
              type="text"
              value={currentValue}
              onChange={(e) => handleInputChange(key, e.target.value)}
              className="w-full px-4 py-2 bg-background-dark border border-gray-700 rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          );
        }
      } else {
        // Input de texto estándar
        inputComponent = (
          <input
            id={key}
            type="text"
            value={currentValue}
            onChange={(e) => handleInputChange(key, e.target.value)}
            className="w-full px-4 py-2 bg-background-dark border border-gray-700 rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        );
      }
    } else if (Array.isArray(currentValue)) {
      // Array, mostrarlo como texto
      inputComponent = (
        <input
          id={key}
          type="text"
          value={currentValue.join(", ")}
          onChange={(e) => handleInputChange(key, e.target.value.split(", "))}
          className="w-full px-4 py-2 bg-background-dark border border-gray-700 rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      );
    } else if (typeof currentValue === "object" && currentValue !== null) {
      // Objeto, mostrarlo como JSON
      inputComponent = (
        <textarea
          id={key}
          value={JSON.stringify(currentValue, null, 2)}
          onChange={(e) => {
            try {
              const newValue = JSON.parse(e.target.value);
              handleInputChange(key, newValue);
            } catch (err) {
              // Ignorar errores de parsing
            }
          }}
          className="w-full px-4 py-2 bg-background-dark border border-gray-700 rounded-md text-text-primary focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm h-32"
        />
      );
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start py-4 border-b border-gray-700 last:border-0">
        <div>
          <label
            htmlFor={key}
            className="block text-sm font-medium text-text-primary"
          >
            {key}
          </label>
          {description && (
            <p className="mt-1 text-xs text-text-secondary">{description}</p>
          )}
        </div>
        <div className="lg:col-span-2 flex items-center space-x-2">
          {inputComponent}
          <button
            type="button"
            className="text-text-secondary hover:text-text-primary"
            onClick={() => handleResetSetting(key)}
            title="Restablecer a valor por defecto"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // Traducir nombres de categorías
  const translateCategoryName = (category) => {
    const translations = {
      general: "General",
      system: "Sistema",
      streaming: "Streaming",
      transcoding: "Transcodificación",
      security: "Seguridad",
      ui: "Interfaz",
      libraries: "Bibliotecas",
      metadata: "Metadatos",
    };

    return (
      translations[category] ||
      category.charAt(0).toUpperCase() + category.slice(1)
    );
  };

  // Esqueletos para estado de carga
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-4">
          <div className="h-8 bg-background-card rounded w-1/4 animate-pulse"></div>
          <div className="h-10 bg-background-card rounded w-28 animate-pulse"></div>
        </div>

        <Card>
          <div className="animate-pulse">
            <div className="flex space-x-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 bg-background-dark rounded w-24"
                ></div>
              ))}
            </div>

            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="h-6 bg-background-dark rounded w-3/4"></div>
                  <div className="lg:col-span-2 h-10 bg-background-dark rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera con botones de acción */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Configuración del sistema</h1>
        <div className="flex space-x-3">
          <Button variant="ghost" onClick={handleResetAll} isLoading={saving}>
            Restablecer todo
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveSettings}
            isLoading={saving}
          >
            Guardar cambios
          </Button>
        </div>
      </div>

      {/* Tarjeta de configuraciones */}
      <Card>
        {/* Tabs de categorías */}
        <div className="border-b border-gray-700 mb-4 overflow-x-auto">
          <div className="flex space-x-1 p-1">
            {Object.keys(settingsGroups).map((category) => (
              <button
                key={category}
                className={`px-4 py-2 text-sm font-medium rounded-t-md ${
                  activeTab === category
                    ? "bg-background-dark text-primary border-b-2 border-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setActiveTab(category)}
              >
                {translateCategoryName(category)}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido de la categoría activa */}
        <div className="p-4">
          {Object.keys(settingsGroups).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-secondary">
                No hay configuraciones disponibles
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-bold mb-4">
                {translateCategoryName(activeTab)}
              </h2>

              <div className="space-y-1">
                {settingsGroups[activeTab]?.map((setting) => (
                  <div key={setting.key}>{renderSettingControl(setting)}</div>
                ))}
              </div>

              {settingsGroups[activeTab]?.length === 0 && (
                <p className="text-center py-4 text-text-secondary">
                  No hay configuraciones en esta categoría
                </p>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SystemSettings;
