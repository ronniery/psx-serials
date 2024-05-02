import { CheerioAPI, load } from 'cheerio';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import fs from 'fs/promises';

export type Serial = {
  region: string | undefined;
  title: {
    kanji: string | null;
    occidental: string | undefined;
  };
  system: string;
  version: string;
  edition: string;
  languages: Array<string | undefined>;
  serial: Array<string>;
};

export type SerialVolume = { createdAt: string; serials: Array<Serial> };

export class PSXSerial {
  private readonly client: AxiosInstance;
  private readonly volume: SerialVolume;

  constructor() {
    this.client = axios.create({
      baseURL: 'http://redump.org',
    });

    this.volume = { createdAt: new Date().toISOString(), serials: [] };
  }

  public async run(): Promise<SerialVolume> {
    console.log('Starting PSX Serial fetch operation...');
    const maxPage = await this.getMaxPage();
    console.log(`Max page: ${maxPage}`);

    for (let activePage = 0; activePage < maxPage; activePage++) {
      console.log(`Fetching page ${activePage + 1}...`);
      this.volume.serials = [...this.volume.serials, ...(await this.getSerialsFrom(activePage))];
    }

    console.log('Serials fetched! Writing out to disk...');
    await this.writeSerials();

    return this.volume;
  }

  private async getSerialsFrom(page: number): Promise<Array<Serial>> {
    const $ = await this.getSerialPage(page);
    const $games = $('table.games tbody');
    const $rows = $games.find('tr:not(.th)').toArray();

    return $rows.map((el) => {
      const sourceSerial = $(el).find('td:eq(6)').attr('title') || $(el).find('td:eq(6)').text();
      const gameSerial = sourceSerial
        ?.split(', ')
        .map<string>((serial) => serial.trim().replace('#', '').replace(/\s/g, '-'));

      const region = $(el).find('td:eq(0) > img').attr('title');
      const title = {
        kanji: $(el).find('td:eq(1) > a span').text() || null,
        occidental: $(el)
          .find('td:eq(1) > a')
          ?.html()
          ?.replace(/<br.*>/gi, ''),
      };

      const system = $(el).find('td:eq(2)').text().trim();
      const version = $(el).find('td:eq(3)').text().trim();
      const edition = $(el).find('td:eq(4)').text().trim();
      const languages = $(el)
        .find('td:eq(5) img')
        .toArray()
        .map((img) => $(img).attr('title'));
      const serial = Array.from(new Set(gameSerial).values());

      return {
        region,
        title,
        system: system.toLowerCase(),
        version,
        edition,
        languages,
        serial,
      };
    });
  }

  private async getSerialPage(page: number): Promise<CheerioAPI> {
    return this.getHTMLPage(`/discs/system/psx/?page=${page}`);
  }

  private async getMaxPage(): Promise<number> {
    return this.getHTMLPage('/discs/system/psx/').then(($) => {
      return +$('div.pages li:last-child').text();
    });
  }

  private async getHTMLPage(path: string): Promise<CheerioAPI> {
    const { data: $ } = await this.client.get<any, AxiosResponse<CheerioAPI>>(path, {
      transformResponse: (html) => load(html),
    });

    return $;
  }

  private writeSerials(): Promise<void> {
    return fs.writeFile('serials.json', JSON.stringify(this.volume), {
      encoding: 'utf8',
      mode: '0777',
      flag: 'w',
      flush: true,
    });
  }
}