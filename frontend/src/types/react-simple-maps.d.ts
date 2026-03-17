declare module 'react-simple-maps' {
  import type { ReactNode, CSSProperties } from 'react';

  interface ProjectionConfig {
    scale?: number;
    center?: [number, number];
    rotate?: [number, number, number];
    parallels?: [number, number];
  }

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: CSSProperties;
    className?: string;
    children?: ReactNode;
  }

  interface GeographiesProps {
    geography: string | object;
    children: (args: { geographies: Geography[] }) => ReactNode;
  }

  interface Geography {
    rsmKey: string;
    type: string;
    id?: string | number;
    properties: Record<string, unknown>;
    geometry: object;
  }

  interface GeographyProps {
    geography: Geography;
    style?: {
      default?: CSSProperties;
      hover?: CSSProperties;
      pressed?: CSSProperties;
    };
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    className?: string;
    onClick?: (geo: Geography, evt: React.MouseEvent) => void;
    onMouseEnter?: (geo: Geography, evt: React.MouseEvent) => void;
    onMouseLeave?: (geo: Geography, evt: React.MouseEvent) => void;
  }

  interface MarkerProps {
    coordinates: [number, number];
    children?: ReactNode;
    className?: string;
    onClick?: (evt: React.MouseEvent) => void;
  }

  interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    children?: ReactNode;
    onMoveEnd?: (position: { coordinates: [number, number]; zoom: number }) => void;
  }

  interface SphereProps {
    id?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
  }

  interface GraticuleProps {
    id?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    clipPathId?: string;
  }

  export function ComposableMap(props: ComposableMapProps): JSX.Element;
  export function Geographies(props: GeographiesProps): JSX.Element;
  export function Geography(props: GeographyProps): JSX.Element;
  export function Marker(props: MarkerProps): JSX.Element;
  export function ZoomableGroup(props: ZoomableGroupProps): JSX.Element;
  export function Sphere(props: SphereProps): JSX.Element;
  export function Graticule(props: GraticuleProps): JSX.Element;
}
