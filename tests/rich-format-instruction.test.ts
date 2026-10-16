import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  RICH_FORMAT_INSTRUCTION,
  SIMPLE_LANGUAGE_INSTRUCTION,
  HUMANIZER_INSTRUCTION,
} from '../src/lib/ai-brain/rich-format-instruction';

describe('rich-format-instruction: HUMANIZER_INSTRUCTION & Anti-Slop', () => {
  test('memuat larangan kata-kata klise AI (29 patterns Wikipedia AI signs)', () => {
    assert.match(HUMANIZER_INSTRUCTION, /menyelami/);
    assert.match(HUMANIZER_INSTRUCTION, /tapestry/);
    assert.match(HUMANIZER_INSTRUCTION, /landscape/);
    assert.match(HUMANIZER_INSTRUCTION, /testament/);
    assert.match(HUMANIZER_INSTRUCTION, /negative parallelism/);
    assert.match(HUMANIZER_INSTRUCTION, /holistik/);
  });

  test('melarang pembuka dan penutup basa-basi ala AI', () => {
    assert.match(HUMANIZER_INSTRUCTION, /DILARANG pembuka klise ala AI/);
    assert.match(HUMANIZER_INSTRUCTION, /Tentu!/);
    assert.match(HUMANIZER_INSTRUCTION, /Sebagai AI/);
    assert.match(HUMANIZER_INSTRUCTION, /DILARANG penutup klise ala AI/);
    assert.match(HUMANIZER_INSTRUCTION, /Semoga membantu!/);
  });

  test('mengatur larangan penebalan mekanis (mechanical bolding)', () => {
    assert.match(HUMANIZER_INSTRUCTION, /DILARANG penebalan mekanis/);
  });

  test('memuat panduan transparansi integrasi data dan alur kerja sistem', () => {
    assert.match(HUMANIZER_INSTRUCTION, /ALUR INTEGRASI & TRANSPARANSI DATA/);
    assert.match(HUMANIZER_INSTRUCTION, /modul Kas & Bank/);
    assert.match(HUMANIZER_INSTRUCTION, /agregasi real-time/);
    assert.match(HUMANIZER_INSTRUCTION, /Data kas belum tercatat di sistem/);
  });
});

describe('rich-format-instruction: FORMAT VISUAL & BAHASA MUDAH', () => {
  test('RICH_FORMAT_INSTRUCTION memiliki spesifikasi tabel dan ASCII chart', () => {
    assert.match(RICH_FORMAT_INSTRUCTION, /ASCII bar chart/);
    assert.match(RICH_FORMAT_INSTRUCTION, /Tabel markdown ringkas/);
    assert.match(RICH_FORMAT_INSTRUCTION, /Artinya buat kamu:/);
  });

  test('SIMPLE_LANGUAGE_INSTRUCTION mengatur pembuka langsung dan penjelasan jargon', () => {
    assert.match(SIMPLE_LANGUAGE_INSTRUCTION, /1-2 kalimat INTI/);
    assert.match(SIMPLE_LANGUAGE_INSTRUCTION, /dalam kurung/);
    assert.match(SIMPLE_LANGUAGE_INSTRUCTION, /Artinya buat kamu:/);
  });
});
