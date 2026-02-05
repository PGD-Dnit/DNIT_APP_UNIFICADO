export type LocationPoint = {
  x: number;
  y: number;
  wkid?: number; // default 4326 se não vier
};

/* export type ExposureRef = {
  objectId: number;
  layerUrl: string;     // FeatureServer/0 (ex.: Imagens360/FeatureServer/0)
  title?: string;
  attachmentId?: number; // opcional
}; */
export type ExposureRef = {
  objectId: number;
  layerUrl: string;
  title?: string;
  attrs?: any; // ✅ guarda atributos do graphic clicado (cameraHeading, vfov...)
  acquisitionDate?: number; // se existir no ExposureRef
};

export type SwipeConfig = {
  position: number; // 0..100
  leftTitle?: string;
  rightTitle?: string;
};

export type TileSource = {
  id: string;
  title: string;
  tileUrl: string; // template XYZ
  kind: "planet" | "wayback";
  captured?: string;
};

export type PanoSelection = {
  objectId: number;
  attachmentId: number;
  url: string;
  name?: string;
  contentType?: string;

  cameraHeading?: number | null;
  cameraPitch?: number | null;
  cameraRoll?: number | null;
  vfov?: number | null;
};


