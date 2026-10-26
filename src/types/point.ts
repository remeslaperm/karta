export interface MapPoint {
  id: string
  title: string
  description: string
  category: string
  lat: number
  lng: number
  images: string[]
}

export interface RawRow {
  ID?: string
  Заголовок?: string
  Описание?: string
  Категория?: string
  широта?: string | number
  долгота?: string | number
}
