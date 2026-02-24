import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Point, SiteMetrics } from '../types';
import mapStyle from '../map-style.json';

// Fix leaflet default icon issue in react
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapCanvasProps {
  points: Point[];
  onPointsChange: (points: Point[]) => void;
  isDrawing: boolean;
  isFinished: boolean;
  isClosed?: boolean;
  center?: [number, number];
  customTileUrl?: string;
  showCustomTiles?: boolean;
  snapToPoints?: boolean;
}

function MapEvents({ onMapClick, isDrawing, isFinished, snapToPoints, points, onPointsChange }: { 
  onMapClick?: (e: L.LeafletMouseEvent) => void;
  isDrawing: boolean;
  isFinished: boolean;
  snapToPoints: boolean;
  points: Point[];
  onPointsChange: (points: Point[]) => void;
}) {
  const map = useMap();
  
  useMapEvents({
    click: (e) => {
      if (isDrawing && !isFinished) {
        let newLat = e.latlng.lat;
        let newLng = e.latlng.lng;

        if (snapToPoints && points.length > 0) {
          const clickPoint = map.latLngToContainerPoint(e.latlng);
          const SNAP_THRESHOLD_PIXELS = 15;
          let closestDist = Infinity;
          let snapTarget: Point | null = null;

          for (const p of points) {
            const pContainer = map.latLngToContainerPoint([p.lat, p.lng]);
            const dist = clickPoint.distanceTo(pContainer);
            if (dist < closestDist && dist <= SNAP_THRESHOLD_PIXELS) {
              closestDist = dist;
              snapTarget = p;
            }
          }

          if (snapTarget) {
            newLat = snapTarget.lat;
            newLng = snapTarget.lng;
          }
        }

        onPointsChange([...points, { lat: newLat, lng: newLng }]);
      }
      if (onMapClick) onMapClick(e);
    },
  });
  return null;
}

function MapUpdater({ center }: { center?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 15, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

export function MapCanvas({ points, onPointsChange, isDrawing, isFinished, isClosed = true, center, customTileUrl, showCustomTiles = false, snapToPoints = false }: MapCanvasProps) {
  const positions = useMemo(() => points.map((p) => [p.lat, p.lng] as [number, number]), [points]);

  return (
    <MapContainer
      center={center || [51.505, -0.09]}
      zoom={13}
      style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
      zoomControl={false}
    >
      <TileLayer
        attribution={mapStyle.tileLayer.attribution}
        url={mapStyle.tileLayer.url}
        maxZoom={mapStyle.tileLayer.maxZoom}
      />
      
      {/* Custom Drone Tiles Layer */}
      {showCustomTiles && customTileUrl && (
        <TileLayer
          url={customTileUrl}
          maxZoom={22}
          maxNativeZoom={20}
          zIndex={10}
        />
      )}

      {/* Default Overlay Layer */}
      {!showCustomTiles && mapStyle.overlayLayer && mapStyle.overlayLayer.url && (
        <TileLayer
          attribution={mapStyle.overlayLayer.attribution}
          url={mapStyle.overlayLayer.url}
        />
      )}
      <MapEvents 
        isDrawing={isDrawing} 
        isFinished={isFinished} 
        snapToPoints={snapToPoints} 
        points={points} 
        onPointsChange={onPointsChange} 
      />
      <MapUpdater center={center} />
      
      {!isFinished && positions.length > 0 && (
        <Polyline positions={positions} color="#3b82f6" weight={3} dashArray="5, 10" />
      )}
      
      {isFinished && positions.length > 1 && (
        isClosed ? (
          <Polygon positions={positions} color="#3b82f6" fillColor="#3b82f6" fillOpacity={0.2} weight={3} />
        ) : (
          <Polyline positions={positions} color="#3b82f6" weight={3} />
        )
      )}

      {points.map((p, idx) => (
        <Marker key={idx} position={[p.lat, p.lng]} />
      ))}
    </MapContainer>
  );
}

export function calculateMetrics(points: Point[], isClosed: boolean = true): SiteMetrics {
  if (points.length < 2) {
    return { perimeterMeters: 0, vertexCount: points.length, estimatedWalkTimeMinutes: 0 };
  }

  let perimeter = 0;
  const limit = isClosed ? points.length : points.length - 1;
  
  for (let i = 0; i < limit; i++) {
    const p1 = L.latLng(points[i].lat, points[i].lng);
    const p2 = L.latLng(points[(i + 1) % points.length].lat, points[(i + 1) % points.length].lng);
    perimeter += p1.distanceTo(p2);
  }

  // Walk speed ~ 5 km/h = 83.33 m/min
  const walkTime = perimeter / 83.33;

  return {
    perimeterMeters: Math.round(perimeter * 100) / 100,
    vertexCount: points.length,
    estimatedWalkTimeMinutes: Math.round(walkTime * 10) / 10,
  };
}
