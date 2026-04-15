import * as cheerio from 'cheerio';
import type { SectionData, SectionType } from '../types.js';

export function getDataFromSection(html: string): SectionData | null {
  const $ = cheerio.load(html);
  const sectionType = getSectionType($);
  if (!sectionType) return null;

  switch (sectionType) {
    case 'TITLE':
      return handleTitleSection($);
    case 'SUMMARY':
      return handleSummarySection($);
    case 'VOCABULARY_COLS_IMAGES':
      return handleVocabSection($, '.SetsAudsImgsSlide__set', sectionType);
    case 'VOCABULARY_ROWS_IMAGES':
      return handleVocabSection($, '.MimgSetAudSlide__set', sectionType);
    case 'VOCABULARY_ROWS':
      return handleVocabSection($, '.SetsAudsSlide__set', sectionType);
    default:
      return null;
  }
}

function getSectionType($: cheerio.CheerioAPI): SectionType | null {
  const root = $.root();
  const classes = root.find('[class]').toArray()
    .map(el => $(el).attr('class') || '')
    .join(' ');

  if (classes.includes('section_titleSlide_yes') || root.find('.TitleSlide__title').length > 0) {
    return 'TITLE';
  }
  if (classes.includes('section_summarySlide_yes') || root.find('.section__main').length > 0) {
    return 'SUMMARY';
  }
  if (root.find('.SetsAudsImgsSlide__set').length > 0) return 'VOCABULARY_COLS_IMAGES';
  if (root.find('.MimgSetAudSlide__set').length > 0) return 'VOCABULARY_ROWS_IMAGES';
  if (root.find('.SetsAudsSlide__set').length > 0) return 'VOCABULARY_ROWS';

  return null;
}

function handleTitleSection($: cheerio.CheerioAPI): SectionData {
  const title = $('h3.TitleSlide__title, .TitleSlide__title').first().text().trim() || undefined;
  const description = $('p.TitleSlide__objective, .TitleSlide__objective').first().text().trim() || undefined;

  return { type: 'TITLE', title, description };
}

function handleSummarySection($: cheerio.CheerioAPI): SectionData {
  const main = $('.section__main').first().text().trim();
  return { type: 'SUMMARY', data: main || '' };
}

function handleVocabSection(
  $: cheerio.CheerioAPI,
  setSelector: string,
  type: SectionType,
): SectionData {
  const definitions: Array<{ key: string; value: string }> = [];
  const data: string[] = [];
  const title = $('h3, .section__title').first().text().trim() || undefined;

  $(setSelector).each((_i, set) => {
    const keyPhrase = $(set).find('.key-phrase').text().trim();
    if (keyPhrase) {
      // Get the full text and remove the key phrase to get the definition
      const fullText = $(set).text().trim();
      const value = fullText.replace(keyPhrase, '').trim();
      if (value) {
        definitions.push({ key: keyPhrase, value });
      } else {
        data.push(keyPhrase);
      }
    } else {
      const text = $(set).text().trim();
      if (text) data.push(text);
    }
  });

  return { type, title, definitions: definitions.length > 0 ? definitions : undefined, data: data.length > 0 ? data : undefined };
}
