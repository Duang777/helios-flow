import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';

const config: Config = {
  title: 'Helios Docs',
  tagline: 'Extensible commerce platform with modular architecture',
  favicon: 'img/helios.svg',
  url: 'https://docs.helios.dev',
  baseUrl: '/',
  organizationName: 'helios',
  projectName: 'documentation',
  onBrokenLinks: 'throw',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],
  plugins: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        indexDocs: true,
        indexBlog: false,
      },
    ],
    function disableModuleConcatenationPlugin() {
      return {
        name: 'disable-module-concatenation',
        configureWebpack() {
          return {
            optimization: {
              concatenateModules: false,
            },
          }
        },
      }
    },
  ],
  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.ts'),
          routeBasePath: '/',
          editUrl: 'https://github.com/helios/helios/tree/main/docs',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
  themeConfig: {
    image: 'img/helios-homepage.jpg',
    navbar: {
      title: 'Helios',
      logo: {
        alt: 'Helios Logo',
        src: 'img/helios.svg',
        href: '/',
      },
      items: [
        {
          type: 'doc',
          docId: 'introduction/use-cases',
          label: 'Introduction',
          position: 'left',
        },
        {
          type: 'doc',
          docId: 'user-guide/overview',
          label: 'User Guide',
          position: 'left',
        },
        {
          type: 'doc',
          docId: 'installation/prerequisites',
          label: 'Installation',
          position: 'left',
        },
        {
          type: 'doc',
          docId: 'architecture/system-overview',
          label: 'Architecture',
          position: 'left',
        },
        {
          type: 'doc',
          docId: 'api/overview',
          label: 'REST API',
          position: 'left',
        },
        {
          type: 'doc',
          docId: 'customization/build-first-app',
          label: 'Customization',
          position: 'left',
        },
        {
          href: 'https://github.com/helios/helios',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Copyright © ${new Date().getFullYear()} Helios. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  },
};

export default config;
