// SPDX-License-Identifier: GPL-3.0-only
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import AboutDialog from '@/components/common/AboutDialog.vue'
import about from '@/generated/about.json'
import * as externalLink from '@/services/platform/externalLink'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function mountOpen() {
  return mount(AboutDialog, { props: { open: true }, attachTo: document.body })
}

describe('AboutDialog (FR-004, contracts/about-screen.md)', () => {
  it('renders every required item', () => {
    const wrapper = mountOpen()
    const text = wrapper.text()
    expect(text).toContain(about.name)
    expect(text).toContain(about.version)
    expect(text).toContain('GPL-3.0-only')
    expect(text).toContain('Ezenitac-AiService/EasyViewer')
    expect(text).toContain('edith2580')
    expect(text).toContain('v0.1.6')
    expect(text).toContain(about.separatedAt)
    expect(text).toContain('macOS · iOS · Linux')
    for (const dep of about.thirdParty) expect(text).toContain(dep.name)
    wrapper.unmount()
  })

  it('never describes the screen as a legal obligation', () => {
    const wrapper = mountOpen()
    expect(wrapper.text()).not.toContain('법적 의무')
    wrapper.unmount()
  })

  it('exposes WAI-ARIA dialog attributes', () => {
    const wrapper = mountOpen()
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    const labelledBy = dialog.attributes('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy as string)?.textContent).toContain('정보')
    wrapper.unmount()
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    const Host = defineComponent({
      components: { AboutDialog },
      setup: () => ({ open: ref(false) }),
      template: `<div><button data-testid="trigger" @click="open = true">정보</button>
        <AboutDialog :open="open" @close="open = false" /></div>`
    })
    const wrapper = mount(Host, { attachTo: document.body })
    const trigger = wrapper.get('[data-testid="trigger"]').element as HTMLButtonElement
    trigger.focus()
    await wrapper.get('[data-testid="trigger"]').trigger('click')
    await nextTick()
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    await nextTick()
    await nextTick()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger)
    wrapper.unmount()
  })

  it('opens links only through the allow-listed external link service', async () => {
    const spy = vi.spyOn(externalLink, 'openExternalLink').mockResolvedValue(true)
    const wrapper = mountOpen()
    const links = wrapper.findAll('[data-external-link]')
    expect(links.length).toBeGreaterThanOrEqual(2)
    for (const link of links) {
      expect(externalLink.isAllowedExternalUrl(link.attributes('data-external-link') as string)).toBe(true)
      await link.trigger('click')
    }
    expect(spy).toHaveBeenCalledTimes(links.length)
    wrapper.unmount()
  })

  it('loads the full third-party notices lazily on request', async () => {
    const wrapper = mountOpen()
    expect(wrapper.find('[data-testid="third-party-notices"]').exists()).toBe(false)
    await wrapper.get('[data-testid="show-notices"]').trigger('click')
    await flushPromises()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="third-party-notices"]').text()).toContain('서드파티 구성요소 고지')
    })
    wrapper.unmount()
  })
})
