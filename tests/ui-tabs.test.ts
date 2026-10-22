import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../src/components/ui/tabs';

test('Tabs provides context to triggers and renders only the active content', () => {
  const markup = renderToStaticMarkup(
    createElement(
      Tabs,
      { defaultValue: 'list' },
      createElement(
        TabsList,
        null,
        createElement(TabsTrigger, { value: 'list' }, 'Daftar Pengajuan'),
        createElement(TabsTrigger, { value: 'stats' }, 'Statistik'),
      ),
      createElement(TabsContent, { value: 'list' }, 'Konten daftar'),
      createElement(TabsContent, { value: 'stats' }, 'Konten statistik'),
    ),
  );

  assert.match(markup, /Daftar Pengajuan/);
  assert.match(markup, /Konten daftar/);
  assert.doesNotMatch(markup, /Konten statistik/);
});
