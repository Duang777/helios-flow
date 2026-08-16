export const features = [
  {
    id: 'projects.view',
    title: 'View projects',
    module: 'projects',
  },
  {
    id: 'projects.manage',
    title: 'Manage projects',
    module: 'projects',
    dependsOn: ['projects.view'],
  },
]

export default features
