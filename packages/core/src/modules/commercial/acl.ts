export const features = [
  {
    id: 'commercial.view',
    title: 'View commercial settlement',
    module: 'commercial',
  },
  {
    id: 'commercial.manage',
    title: 'Manage commercial settlement',
    module: 'commercial',
    dependsOn: ['commercial.view'],
  },
]

export default features
