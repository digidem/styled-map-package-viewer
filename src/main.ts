import { bboxPolygon } from '@turf/bbox-polygon'
import 'maplibre-gl/dist/maplibre-gl.css'
import { pEvent } from 'p-event'

import createProtocolHandler from './protocol-handler.ts'

const input = document.getElementById('file-input') as HTMLInputElement
const button = document.getElementById('open-button') as HTMLButtonElement
const spinner = document.getElementById('spinner') as HTMLDivElement

button?.addEventListener('click', async (ev) => {
  ev.preventDefault()
  ev.stopPropagation()
  input?.click()
})

input?.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !file.name.endsWith('.smp')) return
  setInProgress(true)
  initializeMap(file)
})

setInProgress(false)

function setInProgress(inProgress: boolean) {
  if (inProgress) {
    input?.setAttribute('disabled', 'true')
    button?.setAttribute('disabled', 'true')
    spinner?.classList.remove('hidden')
    button?.classList.add('hidden')
  } else {
    input?.removeAttribute('disabled')
    spinner?.classList.add('hidden')
    button?.classList.remove('hidden')
    button?.removeAttribute('disabled')
  }
}

// Defer map load so it doesn't block the UI
const maplibrePromise = pEvent(window, 'load').then(() => import('maplibre-gl'))
const mapPromise = maplibrePromise.then(({ default: maplibre }) => {
  return new maplibre.Map({ container: 'map' })
})

async function initializeMap(file: File) {
  const maplibre = await maplibrePromise
  const map = await mapPromise
  maplibre.addProtocol('smp', createProtocolHandler(file))
  map.getContainer().style.display = 'block'
  map.getContainer().style.visibility = 'hidden'
  map.setStyle('smp://maps.v1/style.json')
  map.on('styledata', (ev) => {
    map.getContainer().style.visibility = 'visible'
    setInProgress(false)
    // @ts-ignore
    const bounds = ev.style?.stylesheet?.metadata?.['smp:bounds']
    if (!bounds) return
    map.addSource('bounds', {
      type: 'geojson',
      data: bboxPolygon(bounds),
    })
    map.addLayer({
      id: 'bounds',
      type: 'line',
      source: 'bounds',
      layout: {},
      paint: {
        'line-color': '#ff0000',
        'line-opacity': 0.3,
        'line-width': 3,
      },
    })
    console.log(bounds, map.getBounds())
    map.fitBounds(bounds, { duration: 0 })
  })
}
