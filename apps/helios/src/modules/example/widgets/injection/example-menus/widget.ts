import { InjectionPosition } from '@helios/shared/modules/widgets/injection-position'
import type { InjectionMenuItemWidget } from '@helios/shared/modules/widgets/injection'

const widget: InjectionMenuItemWidget = {
  metadata: {
    id: 'example.injection.example-menus',
  },
  menuItems: [
    {
      id: 'example-todos-shortcut',
      labelKey: 'example.menu.todosShortcut',
      label: 'Example Todos',
      icon: 'CheckSquare',
      href: '/backend/todos',
      features: ['example.todos.view'],
      groupId: 'example.nav.group',
      groupLabelKey: 'example.nav.group',
      placement: { position: InjectionPosition.Last },
    },
  ],
}

export default widget
