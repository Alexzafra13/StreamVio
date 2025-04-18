import React, { useState, useEffect, useContext } from 'react';
import { UIContext } from '../../context/UIContext.jsx';
import { MediaContext } from '../../context/MediaContext.jsx';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import MediaGrid from '../media/browser/MediaGrid.jsx';

/**
 * Componente para mostrar el historial de visualización
 */
const WatchHistoryComponent = () => {
  // Estados
  const [activeTab, setActiveTab] = useState('recent');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Contextos
  const { showSuccess, showError, showConfirmation } = useContext(UIContext);
  const { 
    loadWatchHistory, 
    getRecentlyWatched, 
    getInProgress,
    clearWatchHistory
  } = useContext(MediaContext);

  // Cargar datos de historial
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        
        let historyData;
        
        // Cargar diferentes datos según la pestaña activa
        if (activeTab === 'recent') {
          historyData = await getRecentlyWatched(20);
        } else if (activeTab === 'inProgress') {
          historyData = await getInProgress(20);
        } else {
          historyData = await loadWatchHistory({
            limit: 20,
            includeCompleted: true,
            includeDetails: true
          });
        }
        
        setHistory(historyData || []);
      } catch (error) {
        console.error('Error al cargar historial:', error);
        showError('No se pudo cargar el historial de visualización');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [activeTab]);

  // Manejar borrado del historial
  const handleClearHistory = () => {
    showConfirmation(
      'Borrar historial',
      '¿Estás seguro de que deseas borrar todo tu historial de visualización? Esta acción no se puede deshacer.',
      async () => {
        try {
          await clearWatchHistory();
          setHistory([]);
          showSuccess('Historial borrado correctamente');
        } catch (error) {
          console.error('Error al borrar historial:', error);
          showError('No se pudo borrar el historial');
        }
      }
    );
  };

  // Formatear fecha para mostrar
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado con tabs */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Historial de visualización</h1>
        
        <Button 
          variant="ghost" 
          onClick={handleClearHistory}
          disabled={history.length === 0}
        >
          Borrar historial
        </Button>
      </div>

      {/* Pestañas */}
      <div className="border-b border-gray-700 mb-6">
        <div className="flex space-x-1 overflow-x-auto pb-1">
          <button
            className={`px-4 py-2 text-sm font-medium rounded-t-md ${
              activeTab === 'recent' 
                ? 'bg-background-card text-primary border-b-2 border-primary' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('recent')}
          >
            Vistos recientemente
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium rounded-t-md ${
              activeTab === 'inProgress' 
                ? 'bg-background-card text-primary border-b-2 border-primary' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('inProgress')}
          >
            En progreso
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium rounded-t-md ${
              activeTab === 'all' 
                ? 'bg-background-card text-primary border-b-2 border-primary' 
                : 'text-text-secondary hover:text-text-primary'
            }`}
            onClick={() => setActiveTab('all')}
          >
            Todo el historial
          </button>
        </div>
      </div>

      {/* Vista del historial en modo de lista para "Todo el historial" */}
      {activeTab === 'all' && !loading && (
        history.length > 0 ? (
          <Card>
            <table className="w-full text-left">
              <thead className="bg-background-dark">
                <tr>
                  <th className="p-3">Título</th>
                  <th className="p-3">Progreso</th>
                  <th className="p-3 hidden md:table-cell">Tipo</th>
                  <th className="p-3 hidden md:table-cell">Biblioteca</th>
                  <th className="p-3">Visto el</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {history.map(item => (
                  <tr key={item.id} className="hover:bg-background-dark transition-colors">
                    <td className="p-3">
                      <a 
                        href={`/media/${item.media_id}`} 
                        className="font-medium text-primary hover:text-primary-hover"
                      >
                        {item.title}
                      </a>
                    </td>
                    <td className="p-3">
                      {item.completed ? (
                        <span className="px-2 py-1 bg-green-900/30 text-green-500 rounded-full text-xs">
                          Completado
                        </span>
                      ) : (
                        <>
                          {Math.round((item.position / (item.total_duration || 1)) * 100)}%
                          <div className="w-24 h-1.5 bg-gray-700 rounded-full mt-1 overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${Math.round((item.position / (item.total_duration || 1)) * 100)}%` }}
                            ></div>
                          </div>
                        </>
                      )}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      {{
                        'movie': 'Película',
                        'series': 'Serie',
                        'episode': 'Episodio',
                        'music': 'Música',
                        'photo': 'Foto'
                      }[item.type] || item.type}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      {item.library_name}
                    </td>
                    <td className="p-3 text-sm">
                      {formatDate(item.watched_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <div className="text-center py-10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-text-secondary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-bold mb-2">No hay historial</h3>
            <p className="text-text-secondary mb-6">
              Aún no has visualizado ningún contenido.
            </p>
            <Button as="a" href="/media" variant="primary">
              Explorar contenido
            </Button>
          </div>
        )
      )}

      {/* Vista del historial en modo de grid para "Recientes" y "En progreso" */}
      {(activeTab === 'recent' || activeTab === 'inProgress') && (
        <MediaGrid 
          items={history} 
          loading={loading} 
          showEmpty={true}
          emptyMessage={activeTab === 'recent' 
            ? "No has visto ningún contenido recientemente" 
            : "No tienes contenido en progreso"
          }
          aspectRatio={activeTab === 'inProgress' ? '16/9' : '2/3'}
        />
      )}
    </div>
  );
};

export default WatchHistoryComponent;