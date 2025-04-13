import React from "react";
import { Link } from "react-router-dom";

const MediaCard = ({ media, aspectRatio = "2/3" }) => {
  if (!media) return null;

  const { id, title, thumbnail_path, year, type } = media;

  return (
    <Link to={`/media/${id}`} className="block">
      <div className="media-card overflow-hidden rounded-lg shadow-lg">
        <div
          className="relative"
          style={{ paddingBottom: aspectRatio === "2/3" ? "150%" : "56.25%" }}
        >
          {thumbnail_path ? (
            <img
              src={thumbnail_path}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-background-dark">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                />
              </svg>
            </div>
          )}
        </div>
        <div className="p-2">
          <h3 className="font-bold truncate">{title}</h3>
          <div className="flex items-center text-xs text-text-secondary">
            {year && <span>{year}</span>}
            {type && year && <span className="mx-1">•</span>}
            {type && <span>{type}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MediaCard;