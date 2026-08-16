export const features = [
  {
    id: 'governance.view',
    title: 'View governance',
    module: 'governance',
  },
  {
    id: 'governance.manage',
    title: 'Manage governance mappings and findings',
    module: 'governance',
    dependsOn: ['governance.view'],
  },
]

export default features
