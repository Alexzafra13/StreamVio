import React, { useState, useEffect } from "react";
import axios from "axios";
import apiConfig from "../config/api";

const API_URL = apiConfig.API_URL;

function VideoList() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchVideos() {
      try {
        const response = await axios.get(`${API_URL}/api/videos`);
        setVideos(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching videos:", err);
        setError("Error al cargar los videos. Intente nuevamente.");
        setLoading(false);
      }
    }

    fetchVideos();
  }, []);

  if (loading)
    return <div className="text-center py-8">Cargando videos...</div>;
  if (error)
    return <div className="text-center py-8 text-red-500">{error}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {videos.map((video) => (
        <div
          key={video.id}
          className="bg-gray-800 rounded-lg overflow-hidden shadow-lg"
        >
          <div className="relative pb-[56.25%]">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="p-4">
            <h3 className="text-xl font-semibold text-white">{video.title}</h3>
            <p className="text-gray-400 mt-1">{video.description}</p>
            <p className="text-gray-500 mt-2">Duración: {video.duration}</p>
            <a
              href={`/player/${video.id}`}
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Reproducir
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

export default VideoList;
