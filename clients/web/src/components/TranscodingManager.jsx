// clients/web/src/components/TranscodingManager.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function TranscodingManager({ mediaId, onComplete = () => {} }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [job, setJob] = useState(null);
  const [progress, setProgress] = useState(0);
  const [mediaDetails, setMediaDetails] = useState(null);

  // Cargar perfiles de transcodificación
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const token = localStorage.getItem("streamvio_token");
        if (!token) {
          setError("Se requiere autenticación para esta función");
          setLoading(false);
          return;
        }

        const response = await axios.get(
          `${API_URL}/api/transcoding/profiles`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        setProfiles(response.data);

        // Seleccionar el perfil estándar por defecto
        const standardProfile = response.data.find((p) => p.id === "standard");
        if (standardProfile) {
          setSelectedProfile(standardProfile.id);
        } else if (response.data.length > 0) {
          setSelectedProfile(response.data[0].id);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error al cargar perfiles de transcodificación:", err);
        setError(
          err.response?.data?.message ||
            "Error al cargar perfiles de transcodificación"
        );
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  // Cargar detalles del medio
  useEffect(() => {
    const fetchMediaDetails = async () => {
      if (!mediaId) return;

      try {
        const token = localStorage.getItem("streamvio_token");
        if (!token) return;

        const response = await axios.get(`${API_URL}/api/media/${mediaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setMediaDetails(response.data);
      } catch (err) {
        console.error("Error al cargar detalles del medio:", err);
      }
    };

    fetchMediaDetails();
  }, [mediaId]);

  // Comprobar estado del trabajo actual
  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;

    const checkJobStatus = async () => {
      try {
        const token = localStorage.getItem("streamvio_token");
        if (!token) return;

        const response = await axios.get(
          `${API_URL}/api/transcoding/jobs/${job.jobId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setJob(response.data);
        setProgress(response.data.progress || 0);

        // Si el trabajo se completó, notificar
        if (response.data.status === "completed") {
          onComplete(response.data);
        }
      } catch (err) {
        console.error("Error al verificar estado del trabajo:", err);
      }
    };

    // Verificar cada 3 segundos
    const interval = setInterval(checkJobStatus, 3000);

    // Limpiar intervalo al desmontar
    return () => clearInterval(interval);
  }, [job, onComplete]);

  // Iniciar trabajo de transcodificación
  const startTranscoding = async () => {
    if (!selectedProfile || !mediaId) return;

    try {
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        setError("Se requiere autenticación para esta función");
        return;
      }

      // Enviar solicitud para iniciar transcodificación
      const response = await axios.post(
        `${API_URL}/api/transcoding/media/${mediaId}`,
        { profile: selectedProfile, forceRegenerate: false },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Actualizar estado con la información del trabajo
      setJob(response.data);
      setProgress(0);
    } catch (err) {
      console.error("Error al iniciar transcodificación:", err);
      setError(
        err.response?.data?.message || "Error al iniciar la transcodificación"
      );
    }
  };

  // Cancelar trabajo actual
  const cancelJob = async () => {
    if (!job || !job.jobId) return;

    try {
      const token = localStorage.getItem("streamvio_token");
      if (!token) return;

      await axios.post(
        `${API_URL}/api/transcoding/jobs/${job.jobId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Actualizar estado del trabajo
      setJob((prev) => ({ ...prev, status: "cancelled" }));
    } catch (err) {
      console.error("Error al cancelar trabajo:", err);
      setError(err.response?.data?.message || "Error al cancelar el trabajo");
    }
  };

  // Generar streaming HLS
  const createHLSStream = async () => {
    try {
      setError(null);

      const token = localStorage.getItem("streamvio_token");
      if (!token) {
        setError("Se requiere autenticación para esta función");
        return;
      }

      // Enviar solicitud para iniciar generación HLS
      const response = await axios.post(
        `${API_URL}/api/transcoding/media/${mediaId}/hls`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Actualizar estado con la información del trabajo
      setJob(response.data);
      setProgress(0);
    } catch (err) {
      console.error("Error al iniciar streaming HLS:", err);
      setError(
        err.response?.data?.message || "Error al iniciar el streaming HLS"
      );
    }
  };

  // Formatear tiempo restante
  const formatRemainingTime = () => {
    if (!job || progress <= 0 || progress >= 100) return "";

    // Calcular tiempo restante aproximado
    const elapsedMs = job.started_at
      ? new Date().getTime() - new Date(job.started_at).getTime()
      : 0;

    if (elapsedMs <= 0 || progress <= 0) return "";

    // Calcular ms totales estimados y restantes
    const totalMs = elapsedMs / (progress / 100);
    const remainingMs = totalMs - elapsedMs;

    // Convertir a minutos y segundos
    const remainingMinutes = Math.floor(remainingMs / 60000);
    const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);

    if (remainingMinutes > 0) {
      return `${remainingMinutes} min ${remainingSeconds} seg restantes`;
    } else {
      return `${remainingSeconds} segundos restantes`;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2 text-gray-400">
          Cargando opciones de transcodificación...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-semibold mb-4">
        Opciones de Transcodificación
      </h3>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right text-white"
          >
            &times;
          </button>
        </div>
      )}

      {job && ["processing", "pending"].includes(job.status) ? (
        <div className="mb-6">
          <h4 className="font-medium mb-2">Transcodificación en progreso</h4>

          <div className="w-full bg-gray-700 rounded-full h-4 mb-2">
            <div
              className="bg-blue-600 h-4 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <div className="flex justify-between text-gray-400 text-sm">
            <span>{progress}% completado</span>
            <span>{formatRemainingTime()}</span>
          </div>

          <button
            onClick={cancelJob}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
          >
            Cancelar
          </button>
        </div>
      ) : job && job.status === "completed" ? (
        <div className="mb-6 bg-green-800 p-4 rounded">
          <h4 className="font-medium mb-2">Transcodificación completada</h4>

          {job.outputPath && (
            <p className="text-gray-300 text-sm mb-2">
              Archivo disponible en:{" "}
              <span className="font-mono">{job.outputPath}</span>
            </p>
          )}

          <button
            onClick={() => setJob(null)}
            className="mt-2 bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
          >
            Nueva Transcodificación
          </button>
        </div>
      ) : job && ["failed", "cancelled"].includes(job.status) ? (
        <div className="mb-6 bg-red-800 p-4 rounded">
          <h4 className="font-medium mb-2">
            Transcodificación{" "}
            {job.status === "failed" ? "fallida" : "cancelada"}
          </h4>

          {job.error && (
            <p className="text-gray-300 text-sm mb-2">Error: {job.error}</p>
          )}

          <button
            onClick={() => setJob(null)}
            className="mt-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
          >
            Intentar de nuevo
          </button>
        </div>
      ) : (
        <>
          {/* Mostrar opciones de transcodificación */}
          <div className="mb-4">
            <label className="block text-gray-300 mb-2">
              Perfil de Calidad
            </label>
            <select
              value={selectedProfile || ""}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded p-2 focus:outline-none focus:border-blue-500"
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} - {profile.description}
                </option>
              ))}
            </select>

            <p className="text-gray-400 text-sm mt-1">
              Selecciona un perfil según el dispositivo donde se reproducirá el
              contenido
            </p>
          </div>

          {mediaDetails && (
            <div className="mb-4 bg-gray-700 p-3 rounded">
              <h4 className="font-medium mb-2">Información del archivo</h4>
              <p className="text-gray-300 text-sm">
                {mediaDetails.title}
                {mediaDetails.width && mediaDetails.height && (
                  <span>
                    {" "}
                    - {mediaDetails.width}x{mediaDetails.height}
                  </span>
                )}
                {mediaDetails.duration && (
                  <span> - {Math.floor(mediaDetails.duration / 60)} min</span>
                )}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={startTranscoding}
              disabled={!selectedProfile}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition"
            >
              Iniciar Transcodificación
            </button>

            <button
              onClick={createHLSStream}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition"
            >
              Crear Streaming Adaptativo (HLS)
            </button>
          </div>
        </>
      )}

      {/* Información sobre transcodificación */}
      <div className="mt-6 bg-gray-700 p-4 rounded text-sm">
        <h4 className="font-medium mb-2">¿Qué es la transcodificación?</h4>
        <p className="text-gray-300 mb-2">
          La transcodificación convierte tus archivos multimedia al formato
          óptimo para cada dispositivo, mejorando la compatibilidad y reduciendo
          el consumo de datos.
        </p>
        <p className="text-gray-300">
          El streaming adaptativo (HLS) permite que el video se adapte
          automáticamente a la calidad de tu conexión, evitando interrupciones
          durante la reproducción.
        </p>
      </div>
    </div>
  );
}

export default TranscodingManager;
