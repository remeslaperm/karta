<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import CategoryFilter from './components/CategoryFilter.vue'
import MapView from './components/MapView.vue'
import { usePointsData } from './composables/usePointsData'

const { points, warnings, isLoading, error, load } = usePointsData()
const selectedCategories = ref<Set<string>>(new Set())

onMounted(async () => {
  await load()
  const categories = Array.from(new Set(points.value.map((p) => p.category)))
  selectedCategories.value = new Set(categories)
})

const categories = computed(() =>
  Array.from(new Set(points.value.map((p) => p.category))).sort((a, b) => a.localeCompare(b, 'ru'))
)

// Если после загрузки набор категорий меняется (например, перезагрузка данных),
// следим, чтобы выбор оставался согласованным.
watch(categories, (cats, prevCats) => {
  if (prevCats && prevCats.length > 0) return
  selectedCategories.value = new Set(cats)
})

const filteredPoints = computed(() =>
  points.value.filter((p) => selectedCategories.value.has(p.category))
)
</script>

<template>
  <div class="app">
    <header class="app__header">
      <div class="app__heading">
        <p class="app__eyebrow">Пермский край · Новое время</p>
        <h1 class="app__title">Карта промыслов и ремёсел</h1>
      </div>
      <CategoryFilter
        :categories="categories"
        v-model="selectedCategories"
      />
    </header>

    <main class="app__map">
      <div v-if="isLoading" class="app__state">Загрузка данных…</div>
      <div v-else-if="error" class="app__state app__state--error">
        Не удалось загрузить данные: {{ error }}
      </div>
      <template v-else>
        <MapView :points="filteredPoints" />
        <p class="app__count">
          Показано точек: {{ filteredPoints.length }} из {{ points.length }}
        </p>
      </template>
    </main>

    <p v-if="warnings.length" class="app__warnings">
      Часть строк таблицы не удалось разместить на карте ({{ warnings.length }}) — подробности в консоли браузера.
    </p>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg);
}

.app__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.5rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.app__eyebrow {
  margin: 0 0 0.2rem;
  font-size: 0.78rem;
  color: var(--color-accent);
}

.app__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-ink);
}

.app__map {
  position: relative;
  flex: 1;
  min-height: 0;
}

.app__state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 1rem;
  color: var(--color-muted);
}

.app__state--error {
  color: #a4402f;
}

.app__count {
  position: absolute;
  left: 1rem;
  bottom: 1rem;
  z-index: 500;
  margin: 0;
  padding: 0.35rem 0.7rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 0.78rem;
  color: var(--color-muted);
}

.app__warnings {
  margin: 0;
  padding: 0.4rem 1.5rem;
  font-size: 0.75rem;
  color: #a4402f;
  background: #f8ede9;
  border-top: 1px solid #e6c8bf;
}

@media (max-width: 640px) {
  .app__header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
