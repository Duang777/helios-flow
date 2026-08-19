export const features = [
  {
    id: 'insights.view',
    title: 'View insights KPI',
    module: 'insights',
  },
  {
    id: 'insights.manage',
    title: 'Manage insights KPI targets',
    module: 'insights',
    dependsOn: ['insights.view'],
  },
]

export default features
