'use strict';

var cheerio = require('cheerio');
var axios = require('axios');
var fs = require('fs/promises');

class PSXSerial {
    constructor() {
        this.client = axios.create({
            baseURL: 'http://redump.org',
        });
        this.volume = { createdAt: new Date().toISOString(), serials: [] };
    }
    async run() {
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
    async getSerialsFrom(page) {
        const $ = await this.getSerialPage(page);
        const $games = $('table.games tbody');
        const $rows = $games.find('tr:not(.th)').toArray();
        return $rows.map((el) => {
            const sourceSerial = $(el).find('td:eq(6)').attr('title') || $(el).find('td:eq(6)').text();
            const gameSerial = sourceSerial
                ?.split(', ')
                .map((serial) => serial.trim().replace('#', '').replace(/\s/g, '-'));
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
    async getSerialPage(page) {
        return this.getHTMLPage(`/discs/system/psx/?page=${page}`);
    }
    async getMaxPage() {
        return this.getHTMLPage('/discs/system/psx/').then(($) => {
            return +$('div.pages li:last-child').text();
        });
    }
    async getHTMLPage(path) {
        const { data: $ } = await this.client.get(path, {
            transformResponse: (html) => cheerio.load(html),
        });
        return $;
    }
    writeSerials() {
        return fs.writeFile('serials.json', JSON.stringify(this.volume), {
            encoding: 'utf8',
            mode: '0777',
            flag: 'w',
            flush: true,
        });
    }
}

new PSXSerial().run();
