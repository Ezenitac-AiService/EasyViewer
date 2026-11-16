import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, ref, nextTick } from 'vue'
import InAppConfirmModal from '@/components/common/InAppConfirmModal.vue'
import SyncModal from '@/components/library/SyncModal.vue'
import NetworkDownloadModal from '@/components/library/NetworkDownloadModal.vue'
import ViewerSettingsPanel from '@/components/viewer/ViewerSettingsPanel.vue'
import ViewerSideDrawer from '@/components/viewer/ViewerSideDrawer.vue'

describe('Accessible Dialogs WAI-ARIA & focus trap (T025)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('InAppConfirmModal exposes dialog ARIA attributes, traps Tab/Shift+Tab, closes on Escape, and restores trigger focus', async () => {
    const Host = defineComponent({
      components: { InAppConfirmModal },
      setup() {
        const open = ref(false)
        const trigger = ref<HTMLButtonElement | null>(null)
        return { open, trigger }
      },
      template: `
        <div>
          <button ref="trigger" data-testid="trigger" @click="open = true">Open</button>
          <InAppConfirmModal
            :open="open"
            title="삭제 확인"
            message="이 도서를 삭제하시겠습니까?"
            confirm-label="삭제"
            cancel-label="취소"
            @confirm="open = false"
            @cancel="open = false"
          />
        </div>
      `
    })

    const wrapper = mount(Host, { attachTo: document.body })
    const trigger = wrapper.get('[data-testid="trigger"]').element as HTMLButtonElement
    trigger.focus()
    await wrapper.get('[data-testid="trigger"]').trigger('click')
    await nextTick()
    await nextTick()

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBeTruthy()

    const buttons = dialog.findAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
    const first = buttons[0].element as HTMLButtonElement
    const last = buttons[buttons.length - 1].element as HTMLButtonElement

    last.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(first)

    first.focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(last)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    await nextTick()
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it.each([
    {
      name: 'SyncModal',
      mountFn: () =>
        mount(SyncModal, {
          props: { open: true },
          attachTo: document.body,
          global: { stubs: { teleport: true } }
        })
    },
    {
      name: 'NetworkDownloadModal',
      mountFn: () =>
        mount(NetworkDownloadModal, {
          props: { open: true },
          attachTo: document.body,
          global: { stubs: { RouterLink: true } }
        })
    },
    {
      name: 'ViewerSettingsPanel',
      mountFn: () =>
        mount(ViewerSettingsPanel, {
          props: { open: true },
          attachTo: document.body
        })
    },
    {
      name: 'ViewerSideDrawer',
      mountFn: () =>
        mount(ViewerSideDrawer, {
          props: {
            open: true,
            activeTab: 'toc',
            toc: [],
            bookmarks: [],
            searchResults: [],
            isSearching: false
          },
          attachTo: document.body
        })
    }
  ])('$name exposes role="dialog", aria-modal="true", aria-labelledby and closes on Escape', async ({ mountFn }) => {
    const wrapper = mountFn()
    await nextTick()
    await nextTick()
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBeTruthy()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  it('skips hidden/inert elements during Tab focus cycling and closes only the topmost nested dialog on Escape while marking background siblings inert (T054)', async () => {
    const NestedHost = defineComponent({
      components: { InAppConfirmModal },
      setup() {
        const parentOpen = ref(true)
        const childOpen = ref(true)
        return { parentOpen, childOpen }
      },
      template: `
        <div>
          <main data-testid="bg-main"><button data-testid="bg-btn">Background</button></main>
          <InAppConfirmModal
            :open="parentOpen"
            title="상위 모달"
            message="첫 번째 모달"
            @confirm="parentOpen = false"
            @cancel="parentOpen = false"
          />
          <InAppConfirmModal
            :open="childOpen"
            title="하위 확인 모달"
            message="두 번째 중첩 모달"
            @confirm="childOpen = false"
            @cancel="childOpen = false"
          />
        </div>
      `
    })

    const wrapper = mount(NestedHost, { attachTo: document.body })
    await nextTick()
    await nextTick()

    const bgMain = wrapper.get('[data-testid="bg-main"]').element as HTMLElement
    expect(bgMain.hasAttribute('inert') || bgMain.getAttribute('aria-hidden') === 'true').toBe(true)

    const dialogs = wrapper.findAll('[role="dialog"]')
    expect(dialogs).toHaveLength(2)

    // Hide the first button inside topmost dialog and verify Tab skips it
    const topDialog = dialogs[1].element as HTMLElement
    const topButtons = Array.from(topDialog.querySelectorAll<HTMLButtonElement>('button'))
    topButtons[0].style.display = 'none'
    topButtons[topButtons.length - 1].focus()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).not.toBe(topButtons[0])

    // Pressing Escape once must close ONLY the topmost child modal, keeping parentOpen === true
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(wrapper.vm.childOpen).toBe(false)
    expect(wrapper.vm.parentOpen).toBe(true)

    // Pressing Escape a second time closes the parent modal and removes background inert
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(wrapper.vm.parentOpen).toBe(false)
    expect(bgMain.hasAttribute('inert')).toBe(false)

    wrapper.unmount()
  })
})
