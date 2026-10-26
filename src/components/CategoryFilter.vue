<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  categories: string[]
  modelValue: Set<string>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: Set<string>): void
}>()

const isOpen = ref(false)
const rootEl = ref<HTMLElement | null>(null)

const allSelected = computed(() => props.modelValue.size === props.categories.length)
const noneSelected = computed(() => props.modelValue.size === 0)

const summaryLabel = computed(() => {
  if (allSelected.value) return 'Все категории'
  if (noneSelected.value) return 'Категории не выбраны'
  if (props.modelValue.size === 1) return [...props.modelValue][0]
  return `Выбрано категорий: ${props.modelValue.size}`
})

function toggleOpen() {
  isOpen.value = !isOpen.value
}

function toggleCategory(cat: string) {
  const next = new Set(props.modelValue)
  if (next.has(cat)) {
    next.delete(cat)
  } else {
    next.add(cat)
  }
  emit('update:modelValue', next)
}

function selectAll() {
  emit('update:modelValue', new Set(props.categories))
}

function selectNone() {
  emit('update:modelValue', new Set())
}

function handleClickOutside(event: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div ref="rootEl" class="filter" :class="{ 'filter--open': isOpen }">
    <button type="button" class="filter__trigger" @click="toggleOpen">
      <span class="filter__trigger-label">{{ summaryLabel }}</span>
      <span class="filter__chevron" aria-hidden="true">
        <svg width="10" height="6" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
    </button>

    <div v-if="isOpen" class="filter__panel">
      <div class="filter__panel-actions">
        <button type="button" class="filter__link" @click="selectAll">Выбрать все</button>
        <button type="button" class="filter__link" @click="selectNone">Снять все</button>
      </div>
      <ul class="filter__list">
        <li v-for="cat in categories" :key="cat" class="filter__item">
          <label class="filter__checkbox">
            <input
              type="checkbox"
              :checked="modelValue.has(cat)"
              @change="toggleCategory(cat)"
            />
            <span>{{ cat }}</span>
          </label>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.filter {
  position: relative;
  width: min(360px, 100%);
  font-family: var(--font-body);
}

.filter__trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-ink);
  font-size: 0.95rem;
  cursor: pointer;
  text-align: left;
  box-shadow: 0 1px 2px rgba(30, 26, 18, 0.08);
}

.filter--open .filter__trigger {
  border-color: var(--color-accent);
}

.filter__trigger-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter__chevron {
  display: inline-flex;
  transition: transform 0.15s ease;
  color: var(--color-muted);
  flex: none;
}

.filter--open .filter__chevron {
  transform: rotate(180deg);
}

.filter__panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 8px 24px rgba(30, 26, 18, 0.18);
  z-index: 1000;
  max-height: 320px;
  display: flex;
  flex-direction: column;
}

.filter__panel-actions {
  display: flex;
  gap: 1rem;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.filter__link {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-accent);
  font-size: 0.82rem;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.filter__list {
  list-style: none;
  margin: 0;
  padding: 0.3rem 0;
  overflow-y: auto;

  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.filter__list::-webkit-scrollbar {
  width: 6px;
}

.filter__list::-webkit-scrollbar-track {
  background: transparent;
}

.filter__list::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 999px;
}

.filter__list::-webkit-scrollbar-thumb:hover {
  background-color: var(--color-accent);
}

.filter__item {
  padding: 0;
}

.filter__checkbox {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1.35;
}

.filter__checkbox:hover {
  background: var(--color-surface-hover);
}

.filter__checkbox input {
  accent-color: var(--color-accent);
  width: 16px;
  height: 16px;
  flex: none;
}
</style>
