<script setup lang="ts">
import { FolderCog, FolderOpen, RotateCcw } from 'lucide-vue-next'

defineProps<{
  open: boolean
  storageDir: string
  storageIsCustom: boolean
  deleteFileOnRemove: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle'): void
  (e: 'close'): void
  (e: 'open-folder'): void
  (e: 'change-folder'): void
  (e: 'reset-folder'): void
  (e: 'toggle-delete-file', checked: boolean): void
}>()
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold hover:border-indigo-500 transition-all"
      :style="{ borderColor: open ? '#6366f1' : 'var(--ev-border)' }"
      title="소설 저장 폴더"
      aria-label="소설 저장 폴더"
      :aria-expanded="open"
      @click="emit('toggle')"
    >
      <FolderOpen class="w-4 h-4 text-indigo-500" />
      <span>저장 폴더</span>
    </button>

    <template v-if="open">
      <div class="fixed inset-0 z-30" @click="emit('close')" />
      <div
        class="absolute right-0 top-full mt-2 z-40 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-2xl border shadow-xl"
        :style="{ backgroundColor: 'var(--ev-surface)', borderColor: 'var(--ev-border)' }"
      >
        <p class="text-xs font-bold mb-1.5">
          소설 저장 폴더
          <span class="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10 opacity-70">
            {{ storageIsCustom ? '사용자 지정' : '기본' }}
          </span>
        </p>
        <p
          class="text-[11px] font-mono break-all leading-relaxed px-2.5 py-2 rounded-lg bg-black/5 dark:bg-white/5 select-text"
          :title="storageDir"
        >
          {{ storageDir }}
        </p>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all"
            @click="emit('open-folder')"
          >
            <FolderOpen class="w-4 h-4" />
            <span>폴더 열기</span>
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold hover:border-indigo-500 transition-all"
            :style="{ borderColor: 'var(--ev-border)' }"
            @click="emit('change-folder')"
          >
            <FolderCog class="w-4 h-4 text-indigo-500" />
            <span>폴더 변경</span>
          </button>
          <button
            v-if="storageIsCustom"
            type="button"
            class="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold hover:border-indigo-500 transition-all"
            :style="{ borderColor: 'var(--ev-border)' }"
            @click="emit('reset-folder')"
          >
            <RotateCcw class="w-4 h-4 opacity-70" />
            <span>기본 폴더로</span>
          </button>
        </div>

        <p class="mt-3 text-[11px] leading-relaxed opacity-60">
          폴더를 변경하면 이후 추가하는 책부터 새 폴더에 저장됩니다. 이미 추가한 책은 원래 폴더에 그대로 남아 있습니다.
        </p>

        <label class="mt-3 pt-3 border-t flex items-start gap-2.5 cursor-pointer select-none" :style="{ borderColor: 'var(--ev-border)' }">
          <input
            type="checkbox"
            class="mt-0.5 w-4 h-4 shrink-0 accent-indigo-600 cursor-pointer"
            :checked="deleteFileOnRemove"
            @change="emit('toggle-delete-file', ($event.target as HTMLInputElement).checked)"
          />
          <span class="text-xs leading-relaxed">
            <span class="font-semibold">서재에서 삭제할 때 파일도 삭제</span>
            <span class="block text-[11px] opacity-60">끄면 서재 목록에서만 빠지고 파일은 저장 폴더에 남습니다.</span>
          </span>
        </label>
      </div>
    </template>
  </div>
</template>
