// src/modules/imagem_360/SinglePanoViewer.tsx
// Viewer 360 de UMA única imagem (Three.js), derivado do DualPanoViewer.
import { useEffect, useRef } from "react";
import * as THREE from "three";

export type Props = {
  url: string;
  heading?: number | null;
  pitch?: number | null;
  vfov?: number | null;
};

function clamp(num: number, min: number, max: number) {
  return Math.min(max, Math.max(min, num));
}

export default function SinglePanoViewer({ url, heading, pitch, vfov }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;

    let isMounted = true;

    const scene = new THREE.Scene();
    const near = 0.1;
    const far = 1000;
    const aspect = canvas.clientWidth / canvas.clientHeight || 1;
    const initialFov = clamp(vfov ?? 75, 30, 120);

    const camera = new THREE.PerspectiveCamera(initialFov, aspect, near, far);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");

    const texture = textureLoader.load(
      url,
      () => renderOnce(),
      undefined,
      (err) => console.error("❌ SinglePanoViewer textura erro:", url, err)
    );

    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let isUserInteracting = false;
    let onPointerDownX = 0;
    let onPointerDownY = 0;
    let lon = heading ?? 0;
    let lat = -((pitch ?? 0) as number);
    let onPointerDownLon = 0;
    let onPointerDownLat = 0;
    let activePointerId: number | null = null;

    const updateCamera = () => {
      lat = clamp(lat, -85, 85);
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      camera.lookAt(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta)
      );
    };

    const renderOnce = () => {
      updateCamera();
      renderer.render(scene, camera);
    };

    const animate = () => {
      if (!isMounted) return;
      requestAnimationFrame(animate);
      renderOnce();
    };
    animate();

    const onPointerDown = (e: PointerEvent) => {
      isUserInteracting = true;
      activePointerId = e.pointerId;
      onPointerDownX = e.clientX;
      onPointerDownY = e.clientY;
      onPointerDownLon = lon;
      onPointerDownLat = lat;
      e.preventDefault();
      try { (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId); } catch { }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isUserInteracting) return;
      if (activePointerId != null && e.pointerId !== activePointerId) return;
      lon = onPointerDownLon - (e.clientX - onPointerDownX) * 0.1;
      lat = onPointerDownLat + (e.clientY - onPointerDownY) * 0.1;
    };

    const endDrag = (e?: PointerEvent) => {
      if (e?.pointerId != null && activePointerId != null && e.pointerId !== activePointerId) return;
      isUserInteracting = false;
      activePointerId = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.08, 30, 100);
      camera.updateProjectionMatrix();
    };

    const onResize = () => {
      if (!canvasRef.current) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    canvas.style.touchAction = "none";
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("resize", onResize);

    return () => {
      isMounted = false;
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      texture.dispose();
    };
  }, [url, heading, pitch, vfov]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
    />
  );
}
