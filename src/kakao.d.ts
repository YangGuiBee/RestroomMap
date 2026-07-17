// 카카오맵 JS SDK 최소 타입 선언 (필요 부분만)
declare global {
  interface Window {
    kakao: typeof kakao;
  }

  namespace kakao.maps {
    function load(callback: () => void): void;

    class LatLng {
      constructor(lat: number, lng: number);
      getLat(): number;
      getLng(): number;
    }

    class Map {
      constructor(container: HTMLElement, options: { center: LatLng; level: number });
      setCenter(latlng: LatLng): void;
      getCenter(): LatLng;
      setLevel(level: number): void;
      getLevel(): number;
      panTo(latlng: LatLng): void;
    }

    class Marker {
      constructor(options: {
        position: LatLng;
        map?: Map;
        image?: MarkerImage;
        title?: string;
        zIndex?: number;
      });
      setMap(map: Map | null): void;
      setPosition(latlng: LatLng): void;
    }

    class MarkerImage {
      constructor(src: string, size: Size, options?: { offset?: Point });
    }

    class Size {
      constructor(width: number, height: number);
    }

    class Point {
      constructor(x: number, y: number);
    }

    class CustomOverlay {
      constructor(options: {
        position: LatLng;
        content: string | HTMLElement;
        map?: Map;
        yAnchor?: number;
        xAnchor?: number;
        zIndex?: number;
      });
      setMap(map: Map | null): void;
    }

    namespace event {
      function addListener(target: object, type: string, handler: (...args: unknown[]) => void): void;
    }
  }
}

export {};
