/**
 * 右键上下文菜单 composable
 *
 * 按鼠标坐标定位，点击外部/滚动/按 Esc 关闭。
 */

import { ref, onBeforeUnmount, onMounted } from 'vue'

export function useContextMenu() {
  const visible = ref(false)
  const x = ref(0)
  const y = ref(0)

  const close = () => {
    visible.value = false
  }

  const open = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    x.value = event.clientX
    y.value = event.clientY
    visible.value = true
  }

  const handlePointerDown = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('.session-item-context-menu')) {
      return
    }

    close()
  }

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close()
    }
  }

  onMounted(() => {
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('blur', close)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('pointerdown', handlePointerDown)
    window.removeEventListener('scroll', close, true)
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('blur', close)
  })

  return {
    visible,
    x,
    y,
    open,
    close,
  }
}
