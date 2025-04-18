import React, { useState, useEffect, useContext } from 'react';
import { MediaContext } from '../../context/MediaContext.jsx';
import MediaGrid from '../media/browser/MediaGrid.jsx';
import StatCard from './StatCard.jsx';

/**
 * Componente principal para el dashboard
 */
const DashboardComponent = () => {
  const { 
    refreshRecentItems, 
    refreshInProgressItems, 
    getRecommendations, 
    getPopularItems 
  } = useContext(MediaContext);
  
  const [recentItems, setRecentItems] = useState([]);
  const [inProgressItems, setInProgressItems] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [popularItems, setPopularItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // Cargar datos del dashboard en paralelo
        const [recent, inProgress, recommended, popular] = await Promise.all([
          refreshRecentItems(8),
          refreshInProgressItems(8),
          getRecommendations(8),
          getPopularItems(8)
        ]);

        setRecentItems(recent || []);
        setInProgressItems(inProgress || []);
        setRecommendations(recommended || []);
        setPopularItems(popular || []);
      } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Películas" 
          count="--" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>}
          bgColor="bg-primary/10" 
          textColor="text-primary" 
          linkText="Ver películas" 
          linkTo="/media?type=movie" 
        />
        <StatCard 
          title="Series" 
          count="--" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
          bgColor="bg-secondary/10" 
          textColor="text-secondary" 
          linkText="Ver series" 
          linkTo="/media?type=series" 
        />
        <StatCard 
          title="Bibliotecas" 
          count="--" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>}
          bgColor="bg-green-800/10" 
          textColor="text-green-500" 
          linkText="Ver bibliotecas" 
          linkTo="/libraries" 
        />
        <StatCard 
          title="Elementos" 
          count="--" 
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
          bgColor="bg-yellow-800/10" 
          textColor="text-yellow-500" 
          linkText="Ver todo" 
          linkTo="/media" 
        />
      </div>

      {/* Continuar viendo */}
      {inProgressItems.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Continuar viendo</h2>
          <MediaGrid 
            items={inProgressItems} 
            loading={loading} 
            showEmpty={false} 
            aspectRatio="16/9" 
          />
        </section>
      )}

      {/* Vistos recientemente */}
      {recentItems.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Vistos recientemente</h2>
          <MediaGrid 
            items={recentItems} 
            loading={loading} 
            showEmpty={false} 
          />
        </section>
      )}

      {/* Populares en StreamVio */}
      {popularItems.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Populares en StreamVio</h2>
          <MediaGrid 
            items={popularItems} 
            loading={loading} 
            showEmpty={false} 
          />
        </section>
      )}

      {/* Recomendaciones */}
      {recommendations.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Recomendados para ti</h2>
          <MediaGrid 
            items={recommendations} 
            loading={loading} 
            showEmpty={false} 
          />
        </section>
      )}

      {/* Mensaje cuando no hay contenido */}
      {!loading && 
       inProgressItems.length === 0 && 
       recentItems.length === 0 && 
       popularItems.length === 0 && 
       recommendations.length === 0 && (
        <div className="text-center py-10">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-text-secondary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
          <h3 className="text-xl font-bold mb-2">No hay contenido todavía</h3>
          <p className="text-text-secondary mb-6">
            Parece que aún no tienes bibliotecas o contenido multimedia. Comienza añadiendo una biblioteca.
          </p>
          <a href="/libraries/new" className="btn btn-primary">
            Añadir biblioteca
          </a>
        </div>
      )}
    </div>
  );
};

export default DashboardComponent;