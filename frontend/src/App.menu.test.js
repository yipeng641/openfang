// @vitest-environment jsdom

import { mount } from '@vue/test-utils'
import { defineComponent, nextTick, ref } from 'vue'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import Antd from 'ant-design-vue'
import { createMemoryHistory } from 'vue-router'
import App from './App.vue'
import { createAppRouter } from './router'
import { getAccordionOpenKeys, sectionKeys } from './navigation'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
  window.scrollTo = () => {}
})

afterEach(() => {
  window.history.replaceState({}, '', '/')
})

describe('App menu', () => {
  it('baseline ant menu expands with plain bindings', async () => {
    const Demo = defineComponent({
      template: `
        <a-menu v-model:openKeys="openKeys" mode="inline">
          <a-sub-menu key="group-a">
            <template #title>Group A</template>
            <a-menu-item key="item-a">Item A</a-menu-item>
          </a-sub-menu>
          <a-sub-menu key="group-b">
            <template #title>Group B</template>
            <a-menu-item key="item-b">Item B</a-menu-item>
          </a-sub-menu>
        </a-menu>
      `,
      setup() {
        const openKeys = ref([])
        return { openKeys }
      },
    })

    const wrapper = mount(Demo, {
      global: {
        plugins: [Antd],
      },
    })

    const titles = wrapper.findAll('.ant-menu-submenu-title')
    await titles[0].trigger('click')
    await nextTick()

    expect(wrapper.findAll('.ant-menu-submenu-open').length).toBe(1)
  })

  it('accordion handler still expands with controlled openKeys', async () => {
    const Demo = defineComponent({
      template: `
        <a-menu
          :open-keys="openKeys"
          :selected-keys="['item-a']"
          mode="inline"
          @update:openKeys="handleOpenChange"
        >
          <a-sub-menu :key="sectionKeys[0]">
            <template #title>Group A</template>
            <a-menu-item key="item-a">Item A</a-menu-item>
          </a-sub-menu>
          <a-sub-menu :key="sectionKeys[1]">
            <template #title>Group B</template>
            <a-menu-item key="item-b">Item B</a-menu-item>
          </a-sub-menu>
        </a-menu>
      `,
      setup() {
        const openKeys = ref([])
        function handleOpenChange(nextOpenKeys) {
          openKeys.value = getAccordionOpenKeys(nextOpenKeys)
        }
        return { handleOpenChange, openKeys, sectionKeys }
      },
    })

    const wrapper = mount(Demo, {
      global: {
        plugins: [Antd],
      },
    })

    const titles = wrapper.findAll('.ant-menu-submenu-title')
    await titles[1].trigger('click')
    await nextTick()

    expect(wrapper.findAll('.ant-menu-submenu-open').length).toBe(1)
  })

  it('expands a submenu when its title is clicked', async () => {
    const router = createAppRouter(createMemoryHistory())
    await router.push('/agents')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [Antd, router],
        stubs: {
          RouterView: { template: '<div data-test="router-view" />' },
        },
      },
    })

    const titles = wrapper.findAll('.ant-menu-submenu-title')
    expect(titles.length).toBeGreaterThan(1)

    await titles[1].trigger('click')
    await nextTick()

    const openSubmenus = wrapper.findAll('.ant-menu-submenu-open')
    expect(openSubmenus.length).toBe(1)
  })
})
