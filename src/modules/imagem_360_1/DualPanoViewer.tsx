import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export type Props = {
  leftUrl: string;
  rightUrl: string;

  leftHeading?: number | null;
  leftPitch?: number | null;
  leftVfov?: number | null;

  rightHeading?: number | null;
  rightPitch?: number | null;
  rightVfov?: number | null;
};

function clamp(num: number, min: number, max: number) {
  return Math.min(max, Math.max(min, num));
}

export default function DualPanoViewer({
  leftUrl,
  rightUrl,
  leftHeading,
  leftPitch,
  leftVfov,
  rightHeading,
  rightPitch,
  rightVfov,
}: Props) {
  const leftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const leftCanvas = leftCanvasRef.current;
    const rightCanvas = rightCanvasRef.current;

    if (!leftCanvas || !rightCanvas) return;
    if (!leftUrl || !rightUrl) return;

    let isMounted = true;

    // ====== CENAS ======
    const sceneLeft = new THREE.Scene();
    const sceneRight = new THREE.Scene();

    const near = 0.1;
    const far = 1000;

    // Aspect inicial (cada canvas pode ter tamanho diferente, mas normalmente são iguais)
    const aspectLeft = leftCanvas.clientWidth / leftCanvas.clientHeight || 1;
    const aspectRight = rightCanvas.clientWidth / rightCanvas.clientHeight || 1;

    // VFOV do serviço pode vir 180 -> clamp
    const initialFovLeft = clamp(leftVfov ?? 75, 30, 120);
    const initialFovRight = clamp(rightVfov ?? 75, 30, 120);

    const cameraLeft = new THREE.PerspectiveCamera(initialFovLeft, aspectLeft, near, far);
    const cameraRight = new THREE.PerspectiveCamera(initialFovRight, aspectRight, near, far);

    const rendererLeft = new THREE.WebGLRenderer({ canvas: leftCanvas, antialias: true });
    rendererLeft.setPixelRatio(window.devicePixelRatio);
    rendererLeft.setSize(leftCanvas.clientWidth, leftCanvas.clientHeight, false);

    const rendererRight = new THREE.WebGLRenderer({ canvas: rightCanvas, antialias: true });
    rendererRight.setPixelRatio(window.devicePixelRatio);
    rendererRight.setSize(rightCanvas.clientWidth, rightCanvas.clientHeight, false);

    // ====== ESFERA 360 ======
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");

    const textureLeft = textureLoader.load(
      leftUrl,
      () => renderOnce(),
      undefined,
      (err) => console.error("❌ textura LEFT erro:", leftUrl, err)
    );

    const textureRight = textureLoader.load(
      rightUrl,
      () => renderOnce(),
      undefined,
      (err) => console.error("❌ textura RIGHT erro:", rightUrl, err)
    );

    const materialLeft = new THREE.MeshBasicMaterial({ map: textureLeft });
    const materialRight = new THREE.MeshBasicMaterial({ map: textureRight });

    const meshLeft = new THREE.Mesh(geometry, materialLeft);
    const meshRight = new THREE.Mesh(geometry.clone(), materialRight);

    sceneLeft.add(meshLeft);
    sceneRight.add(meshRight);

    // ====== CONTROLE COMPARTILHADO (lon/lat) ======
    let isUserInteracting = false;
    let onPointerDownPointerX = 0;
    let onPointerDownPointerY = 0;

    // Inicializa com heading/pitch (graus)
    let lon = leftHeading ?? rightHeading ?? 0;
    let lat = -((leftPitch ?? rightPitch ?? 0) as number);

    let onPointerDownLon = 0;
    let onPointerDownLat = 0;

    // robustez do drag
    let activePointerId: number | null = null;

    const updateCameras = () => {
      lat = clamp(lat, -85, 85);

      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);

      const x = 500 * Math.sin(phi) * Math.cos(theta);
      const y = 500 * Math.cos(phi);
      const z = 500 * Math.sin(phi) * Math.sin(theta);

      const target = new THREE.Vector3(x, y, z);
      cameraLeft.lookAt(target);
      cameraRight.lookAt(target);
    };

    const renderOnce = () => {
      updateCameras();
      rendererLeft.render(sceneLeft, cameraLeft);
      rendererRight.render(sceneRight, cameraRight);
    };

    const animate = () => {
      if (!isMounted) return;
      requestAnimationFrame(animate);
      renderOnce();
    };

    animate();

    // ====== EVENTOS (drag/zoom) ======
    const onPointerDown = (event: PointerEvent) => {
      isUserInteracting = true;
      activePointerId = event.pointerId;

      onPointerDownPointerX = event.clientX;
      onPointerDownPointerY = event.clientY;
      onPointerDownLon = lon;
      onPointerDownLat = lat;

      event.preventDefault();

      try {
        (event.target as HTMLElement)?.setPointerCapture?.(event.pointerId);
      } catch {}
    };

    const onPointerMoveWindow = (event: PointerEvent) => {
      if (!isUserInteracting) return;
      if (activePointerId != null && event.pointerId !== activePointerId) return;

      const deltaX = event.clientX - onPointerDownPointerX;
      const deltaY = event.clientY - onPointerDownPointerY;

      lon = onPointerDownLon - deltaX * 0.1;
      lat = onPointerDownLat + deltaY * 0.1;
    };

    const endDrag = (event?: PointerEvent) => {
      if (event?.pointerId != null && activePointerId != null && event.pointerId !== activePointerId) return;
      isUserInteracting = false;
      activePointerId = null;
    };

    const onPointerUpWindow = (event: PointerEvent) => endDrag(event);
    const onPointerCancelWindow = (event: PointerEvent) => endDrag(event);

    const onMouseWheel = (event: WheelEvent) => {
      event.preventDefault();

      const zoomSpeed = 0.08;
      const minFov = 30;
      const maxFov = 100;

      cameraLeft.fov = THREE.MathUtils.clamp(cameraLeft.fov + event.deltaY * zoomSpeed, minFov, maxFov);
      cameraRight.fov = THREE.MathUtils.clamp(cameraRight.fov + event.deltaY * zoomSpeed, minFov, maxFov);

      cameraLeft.updateProjectionMatrix();
      cameraRight.updateProjectionMatrix();
    };

    const canvases = [leftCanvas, rightCanvas];
    canvases.forEach((c) => {
      c.style.touchAction = "none";
      c.style.cursor = "grab";
      c.addEventListener("pointerdown", onPointerDown);
      c.addEventListener("wheel", onMouseWheel, { passive: false });
    });

    window.addEventListener("pointermove", onPointerMoveWindow);
    window.addEventListener("pointerup", onPointerUpWindow);
    window.addEventListener("pointercancel", onPointerCancelWindow);

    // ====== RESIZE ======
    const onWindowResize = () => {
      if (!leftCanvasRef.current || !rightCanvasRef.current) return;

      const wLeft = leftCanvasRef.current.clientWidth;
      const hLeft = leftCanvasRef.current.clientHeight;
      const wRight = rightCanvasRef.current.clientWidth;
      const hRight = rightCanvasRef.current.clientHeight;

      cameraLeft.aspect = wLeft / hLeft;
      cameraLeft.updateProjectionMatrix();
      rendererLeft.setSize(wLeft, hLeft, false);

      cameraRight.aspect = wRight / hRight;
      cameraRight.updateProjectionMatrix();
      rendererRight.setSize(wRight, hRight, false);
    };

    window.addEventListener("resize", onWindowResize);

    // ====== CLEANUP ======
    return () => {
      isMounted = false;

      canvases.forEach((c) => {
        c.removeEventListener("pointerdown", onPointerDown);
        c.removeEventListener("wheel", onMouseWheel);
      });

      window.removeEventListener("pointermove", onPointerMoveWindow);
      window.removeEventListener("pointerup", onPointerUpWindow);
      window.removeEventListener("pointercancel", onPointerCancelWindow);

      window.removeEventListener("resize", onWindowResize);

      rendererLeft.dispose();
      rendererRight.dispose();

      geometry.dispose();
      materialLeft.dispose();
      materialRight.dispose();
      textureLeft.dispose();
      textureRight.dispose();
    };
  }, [leftUrl, rightUrl, leftHeading, leftPitch, leftVfov, rightHeading, rightPitch, rightVfov]);

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", background: "#111" }}>
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        <canvas ref={leftCanvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
      <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
        <canvas ref={rightCanvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
      </div>
    </div>
  );
}
