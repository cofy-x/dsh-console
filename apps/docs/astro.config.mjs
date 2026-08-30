/**
 * @license
 * Copyright 2026 cofy-x
 * SPDX-License-Identifier: Apache-2.0
 */

import sitemap from '@astrojs/sitemap';
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

const sidebar = [
  {
    label: 'Start',
    translations: { 'zh-CN': '开始' },
    items: [
      { label: 'Overview', translations: { 'zh-CN': '产品概览' }, link: '/' },
      {
        label: 'Quick Start',
        translations: { 'zh-CN': '快速开始' },
        link: '/getting-started/',
      },
    ],
  },
  {
    label: 'Guides',
    translations: { 'zh-CN': '指南' },
    items: [
      {
        label: 'Models and Reasoning',
        translations: { 'zh-CN': '模型与思考等级' },
        link: '/guides/models/',
      },
      {
        label: 'Sessions and Resume',
        translations: { 'zh-CN': 'Session 与恢复' },
        link: '/guides/sessions/',
      },
      {
        label: 'Image Attachments',
        translations: { 'zh-CN': '图片附件' },
        link: '/guides/attachments/',
      },
      {
        label: 'Tools and Permissions',
        translations: { 'zh-CN': '工具与权限' },
        link: '/guides/tools/',
      },
      {
        label: 'Workflows and Plan Review',
        translations: { 'zh-CN': '工作流与计划审阅' },
        link: '/guides/workflows/',
      },
      {
        label: 'Side Conversations and Agents',
        translations: { 'zh-CN': '侧边对话与 Agent' },
        link: '/guides/side-conversations-and-agents/',
      },
      {
        label: 'Debugging',
        translations: { 'zh-CN': '调试' },
        link: '/guides/debugging/',
      },
    ],
  },
  {
    label: 'Reference',
    translations: { 'zh-CN': '参考' },
    items: [
      {
        label: 'Commands',
        translations: { 'zh-CN': '命令' },
        link: '/reference/commands/',
      },
      {
        label: 'CLI and Environment',
        translations: { 'zh-CN': 'CLI 与环境' },
        link: '/reference/cli/',
      },
      {
        label: 'Troubleshooting',
        translations: { 'zh-CN': '故障排查' },
        link: '/troubleshooting/',
      },
    ],
  },
  {
    label: 'Concepts',
    translations: { 'zh-CN': '概念' },
    items: [
      {
        label: 'DSH-native Architecture',
        translations: { 'zh-CN': 'DSH 原生架构' },
        link: '/concepts/architecture/',
      },
    ],
  },
];

export default defineConfig({
  site: 'https://dsh-console.cofy-x.space',
  output: 'static',
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en-US', 'zh-cn': 'zh-CN' } },
    }),
    starlight({
      title: 'DSH Console',
      description:
        'A DSH-native terminal frontend for agents, tools, models, and persistent sessions.',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/custom.css'],
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
        'zh-cn': { label: '简体中文', lang: 'zh-CN' },
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/cofy-x/dsh-console',
        },
      ],
      editLink: {
        baseUrl: 'https://github.com/cofy-x/dsh-console/edit/main/apps/docs/',
      },
      lastUpdated: true,
      pagination: true,
      sidebar,
      head: [
        { tag: 'meta', attrs: { name: 'theme-color', content: '#15171d' } },
        {
          tag: 'meta',
          attrs: {
            property: 'og:site_name',
            content: 'DSH Console Documentation',
          },
        },
        { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://dsh-console.cofy-x.space/social-card.png',
          },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:type', content: 'image/png' },
        },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        {
          tag: 'meta',
          attrs: {
            property: 'og:image:alt',
            content: 'DSH Console: DeepSeek Harness in your terminal',
          },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:image',
            content: 'https://dsh-console.cofy-x.space/social-card.png',
          },
        },
      ],
    }),
  ],
});
