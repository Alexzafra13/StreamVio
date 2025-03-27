// src/components/VideoPlayer.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const VideoPlayer = ({ videoId }) => {
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchVideo() {
      try {
        const response = await axios.get(`http://localhost:3000/api/videos/${videoId}`);
        setVideo(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching video:", err);
        setError("Error al cargar el video. Intente nuevamente.");
        setLoading(false);
      }
    }

    fetchVideo();
  }, [videoId]);

  if (loading) return <div className="text-center py-8">Cargando video...</div>;
  if (error) return <div className="text-center py-8 text-red-500">{error}</div>;
  if (!video) return <div className="text-center py-8">Video no encontrado</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{video.title}</h1>
      <div className="relative pb-[56.25%] bg-black rounded-lg overflow-hidden">
        <video 
          className="absolute inset-0 w-full h-full" 
          controls 
          autoPlay
          src={video.path}
        >
          Tu navegador no soporta el elemento de video.
        </video>
      </div>
      <p className="mt-4 text-gray-300">{video.description}</p>
    </div>
  );
};

export default VideoPlayer;