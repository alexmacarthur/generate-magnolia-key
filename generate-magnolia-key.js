#!/usr/bin/env node

const puppeteer = require('puppeteer');
const cProcess = require('child_process');

const USERNAME = 'superuser';
const PASSWORD = 'superuser'

/**
 * Given a page, log in using username & password.
 * 
 * @param {object} page 
 * @return {Promise}
 */
const authenticate = async (page) => {
    await page.focus('#login-username');
    await page.keyboard.type(USERNAME);
    await page.focus('#login-password');
    await page.keyboard.type(PASSWORD);
    await page.click('#login-button');
    await page.waitForNavigation();
    return;
}

/**
 * Return a new key after generating one in the Magnolia admin.
 * 
 * @param {object} page 
 * @return {Promise}
 */
const getFreshKey = async (page) => {
    await page.goto('http://localhost:8080');
    await authenticate(page);
    await page.goto('http://localhost:8080/.magnolia/admincentral#app:publishing:;');
    
    // Don't love that this is arbitrary, but was having issues with Puppeteer's `.waitFor()` method working as expected. 
    await page.waitFor(2000);
    await page.click('button.v-nativebutton-btn-dialog');
    await page.waitForResponse('http://localhost:8080/.magnolia/admincentral/UIDL/?v-uiId=0');

    return await page.evaluate(() => {
        return document.querySelector('textarea.v-readonly').value;
    });
}

(async () => {
    const browser = await puppeteer.launch({
        args: ['--incognito']
    });
    const authorInstancePage = await browser.newPage();
    const key = await getFreshKey(authorInstancePage);
    cProcess.exec(`echo  ${key} | pbcopy`, 
        function (err) {
            if(err) {
                console.log(error);
            } else {
                console.log(`Key copied: ${key}`);
            }

            process.exit();
        }
    );
})();
