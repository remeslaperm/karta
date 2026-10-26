<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { MapPoint } from '../types/point'

const props = defineProps<{
  points: MapPoint[]
}>()

const mapContainer = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let clusterGroup: L.MarkerClusterGroup | null = null

const DEFAULT_CENTER: L.LatLngExpression = [58.0, 56.2] // Пермский край
const DEFAULT_ZOOM = 7

// Своя метка вместо стандартного синего "пина" Leaflet — капля в цвет темы.
const pointIcon = L.divIcon({
  className: 'point-marker',
  html: `
    <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.8 0 0 5.9 0 13.1 0 22.9 13 34 13 34s13-11.1 13-20.9C26 5.9 20.2 0 13 0z" class="point-marker__pin" />
      <circle cx="13" cy="13" r="4.6" class="point-marker__dot" />
    </svg>
  `,
  iconSize: [26, 34],
  iconAnchor: [13, 34],
  popupAnchor: [0, -30],
})

// Свои иконки кластеров в цветах темы вместо стандартных зелёно-жёлто-оранжевых.
function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount()
  let sizeClass = 'point-cluster--small'
  let size = 36
  if (count >= 50) {
    sizeClass = 'point-cluster--large'
    size = 54
  } else if (count >= 10) {
    sizeClass = 'point-cluster--medium'
    size = 44
  }

  return L.divIcon({
    html: `<span class="point-cluster__inner">${count}</span>`,
    className: `point-cluster ${sizeClass}`,
    iconSize: L.point(size, size, true),
  })
}

// ---- Лайтбокс: просмотр изображения на весь экран поверх карты, попапов и шапки ----
// Создаётся один раз и переиспользуется для любой точки.
let lightboxEl: HTMLDivElement | null = null
let lightboxImg: HTMLImageElement | null = null
let lightboxCounter: HTMLSpanElement | null = null
let lightboxImages: string[] = []
let lightboxIndex = 0

function handleLightboxKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeLightbox()
  else if (event.key === 'ArrowLeft') showLightboxImage(lightboxIndex - 1)
  else if (event.key === 'ArrowRight') showLightboxImage(lightboxIndex + 1)
}

function showLightboxImage(index: number) {
  if (!lightboxImg || !lightboxCounter || lightboxImages.length === 0) return
  lightboxIndex = (index + lightboxImages.length) % lightboxImages.length
  lightboxImg.src = lightboxImages[lightboxIndex]
  lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`
  lightboxEl?.classList.toggle('lightbox--single', lightboxImages.length <= 1)
}

function closeLightbox() {
  lightboxEl?.classList.remove('lightbox--open')
  document.body.classList.remove('lightbox-locked')
  document.removeEventListener('keydown', handleLightboxKeydown)
}

function ensureLightbox(): void {
  if (lightboxEl) return

  const overlay = document.createElement('div')
  overlay.className = 'lightbox'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', 'Просмотр изображения')
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeLightbox()
  })

  const img = document.createElement('img')
  img.className = 'lightbox__image'
  overlay.appendChild(img)

  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'lightbox__close'
  closeBtn.setAttribute('aria-label', 'Закрыть просмотр')
  closeBtn.innerHTML = '&times;'
  closeBtn.addEventListener('click', closeLightbox)
  overlay.appendChild(closeBtn)

  const prevBtn = document.createElement('button')
  prevBtn.type = 'button'
  prevBtn.className = 'lightbox__nav lightbox__nav--prev'
  prevBtn.setAttribute('aria-label', 'Предыдущее изображение')
  prevBtn.textContent = '‹'
  prevBtn.addEventListener('click', () => showLightboxImage(lightboxIndex - 1))
  overlay.appendChild(prevBtn)

  const nextBtn = document.createElement('button')
  nextBtn.type = 'button'
  nextBtn.className = 'lightbox__nav lightbox__nav--next'
  nextBtn.setAttribute('aria-label', 'Следующее изображение')
  nextBtn.textContent = '›'
  nextBtn.addEventListener('click', () => showLightboxImage(lightboxIndex + 1))
  overlay.appendChild(nextBtn)

  const counter = document.createElement('span')
  counter.className = 'lightbox__counter'
  overlay.appendChild(counter)

  document.body.appendChild(overlay)

  lightboxEl = overlay
  lightboxImg = img
  lightboxCounter = counter
}

function openLightbox(images: string[], startIndex: number) {
  if (images.length === 0) return
  ensureLightbox()
  lightboxImages = images
  showLightboxImage(startIndex)
  lightboxEl?.classList.add('lightbox--open')
  document.body.classList.add('lightbox-locked')
  document.addEventListener('keydown', handleLightboxKeydown)
}

function buildPopupContent(point: MapPoint): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'point-popup'

  if (point.images.length > 0) {
    const gallery = document.createElement('div')
    gallery.className = 'point-popup__gallery'

    let current = 0

    const img = document.createElement('img')
    img.className = 'point-popup__image'
    img.src = point.images[0]
    img.alt = point.title || point.id
    img.addEventListener('click', () => openLightbox(point.images, current))
    gallery.appendChild(img)

    const expandHint = document.createElement('span')
    expandHint.className = 'point-popup__expand-hint'
    expandHint.setAttribute('aria-hidden', 'true')
    expandHint.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    gallery.appendChild(expandHint)

    if (point.images.length > 1) {
      const prevBtn = document.createElement('button')
      prevBtn.type = 'button'
      prevBtn.className = 'point-popup__nav point-popup__nav--prev'
      prevBtn.textContent = '‹'
      prevBtn.setAttribute('aria-label', 'Предыдущее изображение')

      const nextBtn = document.createElement('button')
      nextBtn.type = 'button'
      nextBtn.className = 'point-popup__nav point-popup__nav--next'
      nextBtn.textContent = '›'
      nextBtn.setAttribute('aria-label', 'Следующее изображение')

      const counter = document.createElement('span')
      counter.className = 'point-popup__counter'
      const updateCounter = () => {
        counter.textContent = `${current + 1} / ${point.images.length}`
      }
      updateCounter()

      const showImage = (index: number) => {
        current = (index + point.images.length) % point.images.length
        img.src = point.images[current]
        updateCounter()
      }

      prevBtn.addEventListener('click', (event) => {
        event.stopPropagation()
        showImage(current - 1)
      })
      nextBtn.addEventListener('click', (event) => {
        event.stopPropagation()
        showImage(current + 1)
      })

      gallery.appendChild(prevBtn)
      gallery.appendChild(nextBtn)
      gallery.appendChild(counter)
    }

    wrapper.appendChild(gallery)
  }

  const body = document.createElement('div')
  body.className = 'point-popup__body'
  wrapper.appendChild(body)

  const category = document.createElement('div')
  category.className = 'point-popup__category'
  category.textContent = point.category
  body.appendChild(category)

  if (point.title) {
    const title = document.createElement('h3')
    title.className = 'point-popup__title'
    title.textContent = point.title
    body.appendChild(title)
  }

  if (point.description) {
    const desc = document.createElement('p')
    desc.className = 'point-popup__description'
    desc.textContent = point.description
    body.appendChild(desc)
  }

  return wrapper
}

function renderMarkers(points: MapPoint[]) {
  if (!clusterGroup) return
  clusterGroup.clearLayers()

  points.forEach((point) => {
    const marker = L.marker([point.lat, point.lng], { icon: pointIcon })
    marker.bindPopup(() => buildPopupContent(point), { maxWidth: 320, minWidth: 240 })
    clusterGroup?.addLayer(marker)
  })
}

onMounted(() => {
  if (!mapContainer.value) return

  map = L.map(mapContainer.value, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    // Убираем плашку атрибуции ("Leaflet | Tiles © Esri...") и стандартный
    // зум-контрол — свой, локализованный, добавляем ниже.
    attributionControl: false,
    zoomControl: false,
  })

  // Зум-контрол с русскими подсказками вместо дефолтных английских.
  L.control
    .zoom({
      position: 'topleft',
      zoomInTitle: 'Приблизить',
      zoomOutTitle: 'Отдалить',
    })
    .addTo(map)

  // OpenTopoMap — бесплатно, без API-ключа. Топографический стиль (рельеф,
  // тёплые охристые тона) выглядит выразительнее голого OSM и хорошо сочетается
  // с исторической темой карты. Подписи городов/областей — из данных OSM,
  // то есть на русском для объектов в России, как и раньше.
  // Важно: у сервиса нет тайлов глубже 17 зума (в отличие от 19 у обычного OSM).
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    subdomains: 'abc',
  }).addTo(map)

  clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    maxClusterRadius: 60,
    iconCreateFunction: createClusterIcon,
  })
  map.addLayer(clusterGroup)

  renderMarkers(props.points)
})

watch(
  () => props.points,
  (points) => renderMarkers(points),
  { deep: false }
)

onBeforeUnmount(() => {
  map?.remove()
  map = null
  clusterGroup = null

  document.removeEventListener('keydown', handleLightboxKeydown)
  document.body.classList.remove('lightbox-locked')
  lightboxEl?.remove()
  lightboxEl = null
  lightboxImg = null
  lightboxCounter = null
})
</script>

<template>
  <div ref="mapContainer" class="map-view"></div>
</template>

<style scoped>
.map-view {
  width: 100%;
  height: 100%;
}
</style>

<style>
/* Стили попапа, маркеров и подложки не скоуплены, т.к. Leaflet рендерит их вне дерева Vue */

.leaflet-container {
  background: var(--color-bg);
  font-family: var(--font-body);
}

/* Метка точки */
.point-marker__pin {
  fill: var(--color-accent);
  stroke: var(--color-surface);
  stroke-width: 1.5;
  filter: drop-shadow(0 2px 3px rgba(30, 26, 18, 0.35));
}

.point-marker__dot {
  fill: var(--color-surface);
}

/* Кластеры */
.point-cluster {
  display: flex;
  align-items: center;
  justify-content: center;
}

.point-cluster__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  color: var(--color-surface);
  font-family: var(--font-body);
  font-weight: 600;
  box-shadow: 0 2px 6px rgba(30, 26, 18, 0.35);
}

.point-cluster--small .point-cluster__inner {
  background: var(--color-accent);
  font-size: 0.8rem;
  border: 2px solid var(--color-surface);
}

.point-cluster--medium .point-cluster__inner {
  background: #8a6a2f;
  font-size: 0.92rem;
  border: 3px solid var(--color-surface);
}

.point-cluster--large .point-cluster__inner {
  background: #7a3a24;
  font-size: 1.05rem;
  border: 3px solid var(--color-surface);
}

/* Элементы управления картой в тон общей палитре */
.leaflet-bar,
.leaflet-bar a {
  background: var(--color-surface);
  color: var(--color-ink);
  border-color: var(--color-border) !important;
}

.leaflet-bar a:hover {
  background: var(--color-surface-hover);
}

.leaflet-control-attribution {
  background: rgba(247, 242, 230, 0.85) !important;
  color: var(--color-muted);
}

.leaflet-control-attribution a {
  color: var(--color-accent);
}

.leaflet-popup-content-wrapper {
  background: var(--color-surface);
  color: var(--color-ink);
  border-radius: 0;
  box-shadow: 0 10px 30px rgba(30, 26, 18, 0.25);
  overflow: hidden; /* не даёт содержимому (картинке) вылезать за пределы карточки */
}

.leaflet-popup-tip {
  background: var(--color-surface);
}

/* Сбрасываем дефолтные отступы Leaflet — паддинги задаём сами по частям,
   иначе галерея не может встать вплотную к краям карточки без наложений. */
.leaflet-popup-content {
  margin: 0;
}

.leaflet-popup-close-button {
  top: 6px !important;
  right: 6px !important;
  width: 24px !important;
  height: 24px !important;
  line-height: 22px !important;
  text-align: center;
  border-radius: 50%;
  background: rgba(30, 26, 18, 0.55) !important;
  color: #fff !important;
  font-size: 18px !important;
}

.leaflet-popup-close-button:hover {
  background: rgba(30, 26, 18, 0.78) !important;
  color: #fff !important;
}

.point-popup {
  font-family: var(--font-body);
  display: flex;
  flex-direction: column;
}

.point-popup__gallery {
  position: relative;
  overflow: hidden;
  background: #d8d0bd;
}

.point-popup__image {
  display: block;
  width: 100%;
  height: 170px;
  object-fit: cover;
  cursor: zoom-in;
}

.point-popup__expand-hint {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(30, 26, 18, 0.5);
  color: #fff;
  pointer-events: none;
}

.point-popup__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(30, 26, 18, 0.45);
  color: #fff;
  border: none;
  width: 28px;
  height: 28px;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 999px;
}

.point-popup__nav--prev {
  left: 8px;
}

.point-popup__nav--next {
  right: 8px;
}

.point-popup__counter {
  position: absolute;
  bottom: 8px;
  left: 8px;
  background: rgba(30, 26, 18, 0.55);
  color: #fff;
  font-size: 0.72rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}

.point-popup__body {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem 0.9rem 0.85rem;
}

.point-popup__category {
  text-transform: none;
  font-size: 0.72rem;
  letter-spacing: 0.02em;
  color: var(--color-accent);
}

.point-popup__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  line-height: 1.3;
  color: var(--color-ink);
}

.point-popup__description {
  margin: 0;
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--color-ink-soft);
  max-height: 160px;
  overflow-y: auto;
  padding-right: 0.4rem;

  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.point-popup__description::-webkit-scrollbar {
  width: 6px;
}

.point-popup__description::-webkit-scrollbar-track {
  background: transparent;
}

.point-popup__description::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 999px;
}

.point-popup__description::-webkit-scrollbar-thumb:hover {
  background-color: var(--color-accent);
}

/* ---- Лайтбокс: полноэкранный просмотр изображений поверх карты и попапов ---- */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: none;
  align-items: center;
  justify-content: center;
  background: rgba(20, 17, 10, 0.9);
  padding: 2.5rem;
}

.lightbox--open {
  display: flex;
}

.lightbox__image {
  max-width: min(90vw, 1100px);
  max-height: 86vh;
  object-fit: contain;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.lightbox__close,
.lightbox__nav {
  position: absolute;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: var(--color-surface);
  cursor: pointer;
  line-height: 1;
}

.lightbox__close:hover,
.lightbox__nav:hover {
  background: rgba(255, 255, 255, 0.24);
}

.lightbox__close {
  top: 1rem;
  right: 1.2rem;
  width: 40px;
  height: 40px;
  font-size: 1.6rem;
}

.lightbox__nav {
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  font-size: 1.8rem;
}

.lightbox__nav--prev {
  left: 1rem;
}

.lightbox__nav--next {
  right: 1rem;
}

.lightbox__counter {
  position: absolute;
  bottom: 1.2rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(255, 255, 255, 0.12);
  color: var(--color-surface);
  font-size: 0.85rem;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
}

.lightbox--single .lightbox__nav,
.lightbox--single .lightbox__counter {
  display: none;
}

body.lightbox-locked {
  overflow: hidden;
}
</style>
